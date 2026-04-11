import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, ExternalLink, CheckCircle2 } from "lucide-react";

const Review = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id") || "";
  const token = searchParams.get("token") || "";
  const initialRating = parseInt(searchParams.get("rating") || "0", 10);

  const [rating, setRating] = useState(initialRating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gmbUrl, setGmbUrl] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [threshold, setThreshold] = useState(4);

  useEffect(() => {
    // Fetch GMB URL and review threshold from settings
    supabase
      .from("global_settings")
      .select("key, value")
      .in("key", ["gmb_review_url", "review_threshold"])
      .then(({ data }) => {
        data?.forEach((r) => {
          if (r.key === "gmb_review_url") setGmbUrl(r.value || "");
          if (r.key === "review_threshold") setThreshold(parseInt(r.value, 10) || 4);
        });
      });

    // Fetch order number for display
    if (orderId) {
      supabase.functions
        .invoke("get-order-status", {
          body: { order_id: orderId, lookup_token: token },
        })
        .then(({ data }) => {
          if (data?.order_number) setOrderNumber(data.order_number);
        })
        .catch(() => {});
    }
  }, [orderId, token]);

  // Auto-submit if rating came in URL
  useEffect(() => {
    if (initialRating > 0 && !submitted) {
      handleSubmit(initialRating);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRating]);

  const handleSubmit = async (selectedRating?: number) => {
    const finalRating = selectedRating || rating;
    if (!finalRating || !orderId) return;

    setSubmitting(true);
    try {
      await supabase.from("reviews").insert({
        order_id: orderId,
        order_number: orderNumber || null,
        rating: finalRating,
        feedback: feedback.trim() || null,
        sent_to_gmb: finalRating >= threshold && !!gmbUrl,
        review_submitted_at: new Date().toISOString(),
      } as any);

      setRating(finalRating);
      setSubmitted(true);

      // If low rating, send private feedback to owner
      if (finalRating < threshold && feedback.trim()) {
        supabase.functions
          .invoke("send-email", {
            body: {
              type: "contact",
              data: {
                name: `Review Feedback (${orderNumber || orderId})`,
                email: "no-reply@riversand.net",
                message: `Rating: ${finalRating}/5\n\nFeedback: ${feedback.trim()}`,
              },
            },
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error("[Review] Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_BLACK.png.png"
            alt="River Sand"
            className="h-10 mx-auto mb-4"
          />
          <div className="w-12 h-0.5 mx-auto mb-6" style={{ backgroundColor: "#C07A00" }} />
        </div>

        {!submitted ? (
          <div className="bg-card rounded-2xl border shadow-sm p-8 text-center">
            <h1 className="text-xl font-bold text-foreground mb-2">How was your delivery?</h1>
            {orderNumber && (
              <p className="text-sm text-muted-foreground mb-6">Order {orderNumber}</p>
            )}

            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className="w-10 h-10"
                    fill={star <= displayRating ? "#F59E0B" : "none"}
                    stroke={star <= displayRating ? "#F59E0B" : "#D1D5DB"}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>

            {rating > 0 && rating < threshold && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">
                  We're sorry to hear that. Tell us what happened:
                </p>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Your feedback helps us improve..."
                  rows={4}
                  className="text-base"
                  maxLength={1000}
                />
              </div>
            )}

            {rating > 0 && (
              <Button
                onClick={() => handleSubmit()}
                disabled={submitting}
                className="w-full h-12 text-base font-bold"
                style={{ backgroundColor: "#0D2137" }}
              >
                {submitting ? "Submitting..." : "Submit Review"}
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-2xl border shadow-sm p-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h1 className="text-xl font-bold text-foreground mb-2">
              Thanks for the {rating}★ rating!
            </h1>

            {rating >= threshold && gmbUrl ? (
              <>
                <p className="text-sm text-muted-foreground mb-6">
                  Would you mind sharing your experience on Google? It helps other homeowners find quality river sand.
                </p>
                <a
                  href={gmbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-white font-bold text-base transition-colors"
                  style={{ backgroundColor: "#C07A00" }}
                >
                  <ExternalLink className="w-5 h-5" />
                  Leave a Google Review
                </a>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {feedback
                  ? "We appreciate your honest feedback. Our team will review it."
                  : "We appreciate your feedback!"}
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-8">
              River Sand · Real Sand. Real People.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Review;
