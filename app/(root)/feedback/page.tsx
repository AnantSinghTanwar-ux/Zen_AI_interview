"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import PageLayout from "@/components/PageLayout";
import FeedbackDisplay from "@/components/FeedbackDisplay";
import PremiumAccessPopup from "@/components/PremiumAccessPopup";
import { User } from "@/types";
import { Clock, MessageSquare, ChevronRight, Activity } from "lucide-react";

// Force dynamic rendering for this page since it uses authentication
export const dynamic = 'force-dynamic';

interface CallData {
  id: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  cost?: number;
  messageCount?: number;
  hasArtifact?: boolean;
}

function FeedbackPageContent() {
  const [user, setUser] = useState<User | null>(null);
  const [callData, setCallData] = useState<CallData[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPremiumPopup, setShowPremiumPopup] = useState(false);
  const [premiumMessage, setPremiumMessage] = useState<string | undefined>(undefined);
  const searchParams = useSearchParams();
  
  // Get callId from URL parameters if provided
  const urlCallId = searchParams.get('callId');

  useEffect(() => {
    const initializePage = async () => {
      try {
        const [currentUser, response] = await Promise.all([
          getCurrentUser(),
          fetch('/api/vapi/call-data?limit=10', { credentials: 'include' }),
        ]);

        setUser(currentUser);

        if (!currentUser) {
          setCallData([]);
          return;
        }

        if (response.status === 402) {
          const payload = await response.json().catch(() => ({}));
          setPremiumMessage(
            payload?.message ||
              'Premium is required to continue using this Vapi AI feature.'
          );
          setShowPremiumPopup(true);
          setCallData([]);
          return;
        }

        if (response.ok) {
          const calls = await response.json();
          setCallData(calls);

          // If a specific callId is provided in URL, select that call
          if (urlCallId) {
            const targetCall = calls.find((call: CallData) => call.id === urlCallId);
            if (targetCall) {
              setSelectedCall(targetCall);
            }
          } else if (calls.length > 0) {
            // Default to the most recent call
            setSelectedCall(calls[0]);
          }
        }
      } catch (error) {
        console.error("Error initializing feedback page:", error);
      } finally {
        setLoading(false);
      }
    };

    initializePage();
  }, [urlCallId]);

  if (loading) {
    return (
      <PageLayout>
        <div className="min-h-screen p-6 pt-32">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-white/5 border border-white/10 rounded w-64 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-white/5 border border-white/10 rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!user) {
    return (
      <PageLayout>
        <div className="min-h-screen p-6 pt-32 flex items-center justify-center">
            <div className="glass-card p-10 text-center max-w-md animate-stagger-1">
                <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary to-[#ba9eff] bg-clip-text text-transparent">Access Denied</h1>
                <p className="text-muted-foreground font-medium">You must be logged in to view feedback.</p>
            </div>
        </div>
      </PageLayout>
    );
  }

  if (callData.length === 0) {
    return (
      <PageLayout>
        <div className="min-h-screen p-6 pt-32 flex items-center justify-center">
          <div className="text-center py-12 glass-card p-12 max-w-lg mb-20 animate-stagger-1 w-full mx-4">
            <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-[0_0_30px_rgba(157,125,249,0.2)]">
              <Activity className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-foreground text-3xl font-bold mb-4">No Interview Data</h1>
            <p className="text-muted-foreground font-medium text-lg leading-relaxed">Complete an interview session to see detailed feedback and analytics.</p>
          </div>

          <PremiumAccessPopup
            open={showPremiumPopup}
            message={premiumMessage}
            onClose={() => setShowPremiumPopup(false)}
            onActivated={() => {
              window.location.reload();
            }}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen p-6 pt-32 max-w-7xl mx-auto relative z-10">
        <div className="space-y-12">
          {/* Header section with refined typography */}
          <div className="animate-stagger-1">
            <h1 className="text-5xl font-bold mb-4 tracking-tight flex items-center gap-4">
              <span className="bg-gradient-to-r from-primary to-[#ba9eff] text-transparent bg-clip-text">Feedback</span>
              <span className="text-foreground/70 font-light">& Analysis</span>
            </h1>
            <p className="text-muted-foreground text-lg ml-1 font-medium max-w-2xl">
              AI-powered insights extracted from your interview sessions. Review your performance with precision.
            </p>
          </div>

          {/* Call Selection - Glassmorphism UI */}
          {callData.length > 1 && (
            <div className="glass-card p-8 animate-stagger-2">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                 <div className="w-10 h-10 rounded-full bg-primary/20 flex-center border border-primary/30">
                   <Clock className="w-5 h-5 text-primary" />
                 </div>
                 <h3 className="text-foreground font-semibold text-xl tracking-wide">
                   Session History
                 </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {callData.map((call, index) => (
                  <button
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className={`p-5 rounded-2xl border transition-all duration-300 relative group text-left
                      ${selectedCall?.id === call.id
                        ? 'border-primary/50 bg-primary/10 shadow-[0_0_30px_rgba(157,125,249,0.15)] -translate-y-1'
                        : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1'
                      }`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {selectedCall?.id === call.id && (
                      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
                    )}
                    
                    <div className="flex items-center justify-between mb-3">
                       <div className={`font-semibold text-lg ${selectedCall?.id === call.id ? 'text-foreground' : 'text-foreground/80'}`}>
                        {new Date(call.startedAt).toLocaleDateString()}
                      </div>
                      <ChevronRight className={`w-5 h-5 transition-transform duration-300 ${selectedCall?.id === call.id ? 'text-primary translate-x-1' : 'text-foreground/30 group-hover:text-foreground/70 group-hover:translate-x-1'}`} />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                         <Clock className="w-4 h-4 text-muted-foreground/50" />
                         {new Date(call.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 px-2.5 py-1 rounded-md
                          ${selectedCall?.id === call.id ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-muted-foreground border border-white/10'}`}>
                          <Activity className="w-3.5 h-3.5" />
                          {call.status}
                        </div>
                        
                        {call.messageCount && (
                          <div className={`text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-md
                            ${selectedCall?.id === call.id ? 'bg-primary/20 text-foreground border border-primary/30' : 'bg-white/5 text-muted-foreground border border-white/10'}`}>
                            <MessageSquare className="w-3.5 h-3.5" />
                            {call.messageCount} msg
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback Display Container */}
          <div className="animate-stagger-3">
            {selectedCall ? (
              <FeedbackDisplay 
                callId={selectedCall.id}
                userId={user.id}
                callData={selectedCall}
              />
            ) : (
              <div className="text-center py-20 glass-card">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6 border border-white/10">
                  <Activity className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-foreground text-2xl font-semibold mb-3">Select a Session</h3>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">Choose an interview session from the history above to analyze your performance in high fidelity.</p>
              </div>
            )}
          </div>
        </div>

        <PremiumAccessPopup
          open={showPremiumPopup}
          message={premiumMessage}
          onClose={() => setShowPremiumPopup(false)}
          onActivated={() => {
            window.location.reload();
          }}
        />
      </div>
    </PageLayout>
  );
}

// Loading component for Suspense fallback
function FeedbackPageLoading() {
  return (
    <PageLayout>
      <div className="min-h-screen p-6 pt-32">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-white/5 border border-white/10 rounded w-1/3 mb-8"></div>
           <div className="h-64 bg-white/5 border border-white/10 rounded-2xl mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 bg-white/5 border border-white/10 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<FeedbackPageLoading />}>
      <FeedbackPageContent />
    </Suspense>
  );
}