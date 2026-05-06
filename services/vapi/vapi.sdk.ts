import Vapi from "@vapi-ai/web";

const RECRUITER_KEY = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;
const STUDENT_KEY = process.env.NEXT_PUBLIC_VAPI_STUDENT_TOKEN;

declare global {
	interface Window {
		__zenaiVapiRecruiter?: Vapi;
		__zenaiVapiStudent?: Vapi;
	}
}

export function getVapiInstance(type: "recruiter" | "practice" | "dsa" = "recruiter"): Vapi {
	const isStudent = type === "practice" || type === "dsa";
	const key = isStudent ? STUDENT_KEY : RECRUITER_KEY;

	if (!key) {
		console.warn(`VAPI token not configured for type: ${type}`);
	}

	if (typeof window === "undefined") {
		return new Vapi(key || "");
	}

	if (isStudent) {
		return (window.__zenaiVapiStudent ||= new Vapi(key || ""));
	} else {
		return (window.__zenaiVapiRecruiter ||= new Vapi(key || ""));
	}
}

// Fallback legacy export for parts of the app that don't pass type
export const vapi = typeof window !== "undefined" ? getVapiInstance("recruiter") : new Vapi("");
