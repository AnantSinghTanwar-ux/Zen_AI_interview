import Vapi from "@vapi-ai/web";

const KEY = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;

declare global {
	interface Window {
		__zenaiVapiInstance?: Vapi;
	}
}

function createVapiInstance(): Vapi {
	if (!KEY) {
		throw new Error("NEXT_PUBLIC_VAPI_WEB_TOKEN is not configured");
	}

	return new Vapi(KEY);
}

export const vapi =
	typeof window !== "undefined"
		? (window.__zenaiVapiInstance ||= createVapiInstance())
		: createVapiInstance();
