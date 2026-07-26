"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Swords } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "./ui/input";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getClientAuth } from "@/services/firebase/client";
import { signIn, signUp, verifyCaptcha } from "@/lib/actions/auth.actions";
import { checkAuthStatus } from "@/lib/actions/check-auth";
import ReCAPTCHA from "react-google-recaptcha";
import { useState, useRef } from "react";

type FormType = "sign-in" | "sign-up";

const getFormSchema = (type: FormType) =>
  z.object({
    name: type === "sign-up" ? z.string() : z.string().optional(),
    email: z.string().email(),
    password: z.string().min(8, "Password must be 8 char"),
  });

function AuthForm({ type }: { type: FormType }) {
  const formSchema = getFormSchema(type);
  const router = useRouter();
  const searchParams = useSearchParams();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const [captchaValue, setCaptchaValue] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const isSignIn = type == "sign-in";

  const getSafeRedirectPath = () => {
    const redirectParam = searchParams.get("redirect");
    if (!redirectParam) {
      return "/";
    }

    try {
      // Accept either absolute app URL or an internal path while blocking open redirects.
      const redirectUrl = new URL(redirectParam, window.location.origin);
      if (redirectUrl.origin !== window.location.origin) {
        return "/";
      }

      return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}` || "/";
    } catch {
      return redirectParam.startsWith("/") ? redirectParam : "/";
    }
  };

  const syncTokenToExtension = (token: string) => {
    if (!token || typeof window === "undefined") {
      return;
    }

    window.postMessage(
      {

        type: "ZENAI_EXTENSION_SYNC_TOKEN",
        token,
      },
      window.location.origin
    );
  };

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (!captchaValue) {
        toast.error("Please complete the captcha verification");
        return;
      }

      const captchaRes = await verifyCaptcha(captchaValue);
      if (!captchaRes.success) {
        toast.error("Captcha verification failed. Please try again.");
        recaptchaRef.current?.reset();
        setCaptchaValue(null);
        return;
      }

      const auth = getClientAuth();

      if (isSignIn) {
        const { email, password } = values;

        const userCreds = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        const token = await userCreds.user.getIdToken();

        if (!token) {
          toast.error("Sign In Failed");
          return;
        }

        const res = await signIn({ email, idToken: token });

        if (!res.success) {
          toast.error(res.message);
          return;
        }

        syncTokenToExtension(token);

        toast.success("Sign In Success");
        
        // Check if user is a recruiter and redirect accordingly
        const authStatus = await checkAuthStatus();
        if (authStatus.isRecruiter) {
          router.push("/recruiter");
        } else {
          router.push(getSafeRedirectPath());
        }
        form.reset();
      } else {
        const { name, email, password } = values;

        const userCreds = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        const { success, message } = await signUp({
          uid: userCreds.user.uid,
          name: name!,
          email,
          password,
          userType: "candidate",
        });

        if (!success) {
          toast.error(message);
          return;
        }

        toast.success("Account Created Now Pls Log In");
        router.push("/sign-in");
        form.reset();
      }
    } catch (error) {
      console.log(error);
      toast.error(`There was Error ${(error as Error).message}`);
    }
  }

  return (
    <div className="w-full max-w-[500px] mx-auto">
      <div className="glass-card overflow-hidden">
        
        {/* Header Section */}
        <div className="pt-8 pb-4 px-8 text-center bg-[#f5f5f7]">
            <div className="flex items-center justify-center gap-3 mb-2">
                <div className="p-2 rounded-3xl border border-none bg-[#f5f5f7]  flex items-center justify-center shadow-neo-sm">
                  <Swords className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-4xl font-black text-black uppercase tracking-tight">ZENAI</h1>
            </div>
            <h2 className="text-lg font-bold text-black">Practice Job Interviews with AI</h2>
        </div>
        
        {/* Divider */}
        <div className="w-full border-t border-none"></div>

        {/* Form Section */}
        <div className="p-8 bg-[#f5f5f7]">

            <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="w-full space-y-6"
            >
                {!isSignIn && (
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-lg font-black text-black">Name:</FormLabel>
                        <FormControl>
                        <Input 
                            placeholder="John Doe"
                            className="input" 
                            {...field} 
                            type="text" 
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                )}
                <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="text-lg font-black text-black">Email:</FormLabel>
                    <FormControl>
                        <Input 
                            placeholder="mail@example.com"
                            className="input" 
                            {...field} 
                            type="email" 
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="text-lg font-black text-black">Password:</FormLabel>
                    <FormControl>
                        <Input 
                            placeholder="••••••••"
                            className="input" 
                            {...field} 
                            type="password" 
                        />
                    </FormControl>

                    <FormMessage />
                    </FormItem>
                )}
                />

                <div className="flex justify-center pt-2 pb-2">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""}
                      onChange={(val) => setCaptchaValue(val)}
                      theme="light"
                    />
                </div>

                <div className="flex justify-center pt-4">
                    <Button className="btn btn-primary text-lg py-6 px-12" type="submit">
                         {isSignIn ? "Sign In" : "Sign Up"}
                    </Button>
                </div>
            </form>
            </Form>

            <div className="mt-8 text-center text-black font-bold text-lg">
                 {isSignIn ? "No Account Yet? " : "Have an account already? "}
                <Link
                    href={!isSignIn ? "/sign-in" : "/sign-up"}
                    className="hover:underline"
                >
                    {!isSignIn ? "Sign In" : "Sign Up"}
                </Link>
            </div>
        </div>
      </div>
    </div>
  );
}

export default AuthForm;
