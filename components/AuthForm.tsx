"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Swords, Building2 } from "lucide-react";
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
import { signIn, signUp } from "@/lib/actions/auth.actions";
import { useState } from "react";

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

  const isSignIn = type == "sign-in";

  // Recruiter signup state
  const [isRecruiterMode, setIsRecruiterMode] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");

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

  const createRecruiterProfile = async (companyName: string, industry: string) => {
    try {
      const res = await fetch("/api/v2/recruiter/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, industry }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
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
        router.push(getSafeRedirectPath());
        form.reset();
      } else {
        const { name, email, password } = values;

        // Validate recruiter fields
        if (isRecruiterMode) {
          if (!companyName.trim()) {
            toast.error("Company name is required for recruiter signup");
            return;
          }
          if (!industry.trim()) {
            toast.error("Industry is required for recruiter signup");
            return;
          }
        }

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
          userType: isRecruiterMode ? "recruiter" : "candidate",
        });

        if (!success) {
          toast.error(message);
          return;
        }

        // If recruiter mode, auto sign-in and create profile
        if (isRecruiterMode) {
          const token = await userCreds.user.getIdToken();
          const signInRes = await signIn({ email, idToken: token });

          if (signInRes.success) {
            await createRecruiterProfile(companyName.trim(), industry.trim());
            toast.success("Recruiter account created!");
            router.push("/recruiter");
            form.reset();
            return;
          }
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

            {/* Recruiter Toggle (signup only) */}
            {!isSignIn && (
              <div className="mb-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRecruiterMode(false)}
                  className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition-all ${
                    !isRecruiterMode
                      ? "bg-primary text-white shadow-md"
                      : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  }`}
                >
                  <Swords className="w-4 h-4" /> Candidate
                </button>
                <button
                  type="button"
                  onClick={() => setIsRecruiterMode(true)}
                  className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition-all ${
                    isRecruiterMode
                      ? "bg-primary text-white shadow-md"
                      : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  }`}
                >
                  <Building2 className="w-4 h-4" /> Recruiter
                </button>
              </div>
            )}

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

                {/* Recruiter-specific fields */}
                {!isSignIn && isRecruiterMode && (
                  <>
                    <div>
                      <label className="text-lg font-black text-black block mb-2">Company Name:</label>
                      <Input
                        placeholder="Acme Corp"
                        className="input"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        type="text"
                      />
                    </div>
                    <div>
                      <label className="text-lg font-black text-black block mb-2">Industry:</label>
                      <Input
                        placeholder="Technology, Finance, Healthcare..."
                        className="input"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        type="text"
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-center pt-4">
                    <Button className="btn btn-primary text-lg py-6 px-12" type="submit">
                         {isSignIn ? "Sign In" : isRecruiterMode ? "Create Recruiter Account" : "Sign Up"}
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
