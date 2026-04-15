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
import { signIn, signUp } from "@/lib/actions/auth.actions";

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
    <div className="w-full max-w-[500px] mx-auto relative mt-20 mb-20">
      <div className="absolute inset-0 bg-primary/10 rounded-[2rem] blur-2xl transform-gpu"></div>
      <div className="glass-card overflow-hidden rounded-[2rem] border border-white/10 relative z-10 backdrop-blur-2xl">
        
        {/* Header Section */}
        <div className="pt-10 pb-6 px-8 text-center bg-transparent relative">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
            <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                  <Swords className="w-8 h-8 text-primary drop-shadow-[0_0_10px_rgba(157,125,249,0.5)]" />
                </div>
                <h1 className="text-3xl font-bold text-foreground tracking-wide">ZENAI</h1>
            </div>
            <h2 className="text-muted-foreground font-medium">Practice Job Interviews with AI</h2>
        </div>
        
        {/* Divider */}
        <div className="w-full border-t border-white/5"></div>

        {/* Form Section */}
        <div className="p-8 bg-transparent">
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
                        <FormLabel className="text-sm font-semibold text-foreground/80 tracking-wide">Name</FormLabel>
                        <FormControl>
                        <Input 
                            placeholder="John Doe"
                            className="bg-black/40 border border-white/10 focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground rounded-xl h-12 px-4 shadow-inner" 
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
                    <FormLabel className="text-sm font-semibold text-foreground/80 tracking-wide">Email Address</FormLabel>
                    <FormControl>
                        <Input 
                            placeholder="name@example.com"
                            className="bg-black/40 border border-white/10 focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground rounded-xl h-12 px-4 shadow-inner" 
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
                    <FormLabel className="text-sm font-semibold text-foreground/80 tracking-wide">Password</FormLabel>
                    <FormControl>
                        <Input 
                            placeholder="••••••••"
                            className="bg-black/40 border border-white/10 focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground rounded-xl h-12 px-4 shadow-inner" 
                            {...field} 
                            type="password" 
                        />
                    </FormControl>

                    <FormMessage />
                    </FormItem>
                )}
                />

                <div className="flex justify-center pt-6">
                    <Button className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-6 text-lg font-medium shadow-[0_0_20px_rgba(157,125,249,0.3)] hover:shadow-[0_0_30px_rgba(157,125,249,0.5)] transition-all" type="submit">
                         {isSignIn ? "Sign In" : "Create Account"}
                    </Button>
                </div>
            </form>
            </Form>

            <div className="mt-8 text-center text-muted-foreground text-sm">
                 {isSignIn ? "Don't have an account? " : "Already have an account? "}
                <Link
                    href={!isSignIn ? "/sign-in" : "/sign-up"}
                    className="text-primary hover:text-primary-foreground transition-colors font-medium hover:underline underline-offset-4"
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
