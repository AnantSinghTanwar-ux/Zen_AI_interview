// ─── LiveKit WebRTC Interview Room Service ──────────────────────────────────
//
// Manages interview rooms using LiveKit Cloud SFU architecture.
// Supports 200+ concurrent video/audio interview sessions.
//
// Setup:
//   1. Sign up at https://livekit.io
//   2. Create a project → get WebSocket URL
//   3. Generate API key + secret from dashboard
//   4. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET in .env
//
// Architecture:
//   - Each interview gets a unique LiveKit room
//   - Candidates join with publish+subscribe grants
//   - AI agents connect server-side via LiveKit agent protocol
//   - Rooms auto-close after 5min of inactivity

import crypto from "crypto";

const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

/**
 * Check if LiveKit is configured.
 */
export function hasLiveKitConfig(): boolean {
  return Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
}

// ─── JWT Token Generation ───────────────────────────────────────────────────
//
// Implements LiveKit JWT token generation without the SDK dependency.
// This keeps the deployment lightweight for Next.js serverless functions.

interface TokenGrant {
  roomJoin?: boolean;
  room?: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
}

interface TokenClaims {
  iss: string;           // API key
  sub: string;           // participant identity
  name?: string;         // display name
  exp: number;           // expiry (epoch seconds)
  nbf: number;           // not before (epoch seconds)
  iat: number;           // issued at
  jti: string;           // unique token ID
  video?: TokenGrant;    // LiveKit-specific grants
  metadata?: string;     // participant metadata
}

function base64UrlEncode(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generate a LiveKit-compatible JWT access token.
 *
 * This is a minimal implementation that covers the grants needed
 * for interview rooms without pulling in the full livekit-server-sdk.
 */
export function generateLiveKitToken(params: {
  roomName: string;
  participantIdentity: string;
  participantName: string;
  isAgent?: boolean;
  ttlSeconds?: number;
  metadata?: string;
}): string {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error("LiveKit API key and secret are required");
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = params.ttlSeconds || 7200; // 2 hours default

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const claims: TokenClaims = {
    iss: LIVEKIT_API_KEY,
    sub: params.participantIdentity,
    name: params.participantName,
    exp: now + ttl,
    nbf: now,
    iat: now,
    jti: crypto.randomUUID(),
    video: {
      roomJoin: true,
      room: params.roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  if (params.metadata) {
    claims.metadata = params.metadata;
  }

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const signature = crypto
    .createHmac("sha256", LIVEKIT_API_SECRET)
    .update(signingInput)
    .digest();

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

// ─── Room Management ────────────────────────────────────────────────────────

/**
 * Generate a unique room name for an interview session.
 */
export function generateRoomName(
  candidateId: string,
  jobId: string
): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${candidateId}:${jobId}:${Date.now()}`)
    .digest("hex")
    .slice(0, 12);
  return `interview-${hash}`;
}

/**
 * Create a LiveKit room via the REST API.
 *
 * Note: Rooms are auto-created when the first participant joins,
 * so this is optional. Call it when you need to pre-configure
 * room settings (timeout, max participants).
 */
export async function createInterviewRoom(params: {
  roomName: string;
  emptyTimeoutSeconds?: number;
  maxParticipants?: number;
}): Promise<{ roomName: string; created: boolean }> {
  if (!hasLiveKitConfig()) {
    return { roomName: params.roomName, created: false };
  }

  // LiveKit REST API for room creation
  const apiUrl = LIVEKIT_URL.replace("wss://", "https://").replace(
    "ws://",
    "http://"
  );

  // Generate admin token for API access
  const token = generateLiveKitToken({
    roomName: params.roomName,
    participantIdentity: "server",
    participantName: "ZenAI Server",
    ttlSeconds: 60,
  });

  try {
    const response = await fetch(`${apiUrl}/twirp/livekit.RoomService/CreateRoom`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: params.roomName,
        empty_timeout: params.emptyTimeoutSeconds || 300, // 5 min
        max_participants: params.maxParticipants || 3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(
        `[LiveKit] Room creation returned ${response.status}: ${errorText}`
      );
    }

    return { roomName: params.roomName, created: response.ok };
  } catch (err) {
    console.error("[LiveKit] Failed to create room:", err);
    return { roomName: params.roomName, created: false };
  }
}

/**
 * Generate everything needed for a candidate to join an interview room.
 *
 * @returns Room name, candidate token, WebSocket URL, and optional agent token.
 */
export function prepareInterviewSession(params: {
  candidateId: string;
  candidateName: string;
  jobId: string;
}): {
  roomName: string;
  candidateToken: string;
  websocketUrl: string;
  agentToken: string;
} {
  const roomName = generateRoomName(params.candidateId, params.jobId);

  const candidateToken = generateLiveKitToken({
    roomName,
    participantIdentity: `candidate-${params.candidateId}`,
    participantName: params.candidateName,
    metadata: JSON.stringify({
      role: "candidate",
      candidateId: params.candidateId,
      jobId: params.jobId,
    }),
  });

  const agentToken = generateLiveKitToken({
    roomName,
    participantIdentity: `agent-${roomName}`,
    participantName: "ZenAI Interviewer",
    isAgent: true,
    metadata: JSON.stringify({
      role: "agent",
      jobId: params.jobId,
    }),
  });

  return {
    roomName,
    candidateToken,
    websocketUrl: LIVEKIT_URL,
    agentToken,
  };
}
