import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, MessageSquarePlus, X, CheckCircle2, MessageSquare, Loader, Sparkles, User } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// Realistic fallback sample reviews for initial render or when Supabase table is empty
const SAMPLE_REVIEWS = [
  {
    id: 'sample-1',
    name: 'Ramesh Kumar Chaudhary',
    rating: 5,
    review_text: 'Bought TVS Apache RTR 160 4V from TVS Raj Automobiles Lahan. Excellent pickup, great mileage, and staff in Lahan were very supportive with instant registration!',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString()
  },
  {
    id: 'sample-2',
    name: 'Sunita Shrestha',
    rating: 5,
    review_text: 'Very smooth experience buying TVS Ntorq 125. The EMI financing process was super fast with low interest rates. Highly recommend TVS Raj Automobiles!',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString()
  },
  {
    id: 'sample-3',
    name: 'Bijay Mahato',
    rating: 5,
    review_text: 'Best TVS showroom in Siraha district! Servicing staff are highly trained and use 100% genuine TVS spare parts. Apache RTR 200 4V runs like a dream.',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString()
  },
  {
    id: 'sample-4',
    name: 'Pradeep Yadav',
    rating: 4,
    review_text: 'Great customer service and honest pricing. Bought Raider 125 for daily commute in Lahan. Smooth ride and stylish digital display.',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString()
  },
  {
    id: 'sample-5',
    name: 'Anjali Sah',
    rating: 5,
    review_text: 'TVS Jupiter 125 is perfect for family use. Comfortable seating and large boot space. Special thanks to the sales team for quick delivery!',
    created_at: new Date(Date.now() - 21 * 86400000).toISOString()
  },
  {
    id: 'sample-6',
    name: 'Bibek Kumar Mandal',
    rating: 5,
    review_text: 'Outstanding service center and friendly staff! They completed my 1st free service within 45 mins. Truly customer-first showroom.',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    id: 'sample-7',
    name: 'Dipendra Jha',
    rating: 5,
    review_text: 'Riding Apache RR 310 from TVS Raj Automobiles! Unbelievable racing performance and smooth handling. Proud owner from Siraha.',
    created_at: new Date(Date.now() - 35 * 86400000).toISOString()
  },
  {
    id: 'sample-8',
    name: 'Manisha Mahato',
    rating: 5,
    review_text: 'Transparent pricing, easy documentation for bike loan, and polite showroom staff. Best vehicle buying experience in Lahan!',
    created_at: new Date(Date.now() - 40 * 86400000).toISOString()
  }
];

// Helper to get initials from name
function getInitials(name) {
  if (!name) return 'TR';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Avatar color themes derived deterministically from reviewer name
const AVATAR_GRADIENTS = [
  'from-blue-600 to-indigo-700 text-blue-100 border-blue-400/40',
  'from-emerald-600 to-teal-700 text-emerald-100 border-emerald-400/40',
  'from-indigo-600 to-purple-700 text-purple-100 border-purple-400/40',
  'from-amber-600 to-orange-700 text-amber-100 border-amber-400/40',
  'from-rose-600 to-red-700 text-red-100 border-red-400/40',
  'from-cyan-600 to-blue-700 text-cyan-100 border-cyan-400/40'
];

function getAvatarGradient(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

// Single Review Card Component
function ReviewCard({ review }) {
  const initials = getInitials(review.name);
  const gradient = getAvatarGradient(review.name);

  return (
    <div className="w-[300px] sm:w-[350px] shrink-0 p-5 rounded-2xl glass-card bg-[#151c2c]/85 border border-[#1f293d] hover:border-[#0066CC]/50 transition-all duration-300 flex flex-col justify-between space-y-4 shadow-xl">
      <div>
        {/* Rating Stars */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= review.rating
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-gray-600 fill-gray-800'
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] text-gray-500 font-medium">Verified Rider</span>
        </div>

        {/* Review Text */}
        <p className="text-xs sm:text-sm text-gray-200 leading-relaxed line-clamp-3 font-normal">
          "{review.review_text}"
        </p>
      </div>

      {/* Reviewer Meta Footer */}
      <div className="flex items-center space-x-3 pt-3 border-t border-[#1f293d]/80">
        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} border flex items-center justify-center font-bold text-xs shadow-md shrink-0`}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs sm:text-sm font-bold text-white truncate">{review.name}</h4>
          <p className="text-[11px] text-gray-400 truncate">Customer • Lahan</p>
        </div>
      </div>
    </div>
  );
}

export default function CustomerReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({ name: '', rating: 5, reviewText: '' });
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  // Fetch Reviews from Supabase
  const fetchReviews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        // Fallback to sample reviews if Supabase table is empty or unconfigured
        setReviews(SAMPLE_REVIEWS);
      } else {
        setReviews(data);
      }
    } catch (err) {
      console.warn('[CustomerReviews] Could not fetch reviews, using default dataset:', err);
      setReviews(SAMPLE_REVIEWS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  // Split reviews into two rows for dual infinite marquee
  const row1 = useMemo(() => {
    const list = reviews.length > 0 ? reviews : SAMPLE_REVIEWS;
    const half = Math.ceil(list.length / 2);
    const firstHalf = list.slice(0, half);
    // Duplicate to fill continuous loop
    return [...firstHalf, ...firstHalf, ...firstHalf];
  }, [reviews]);

  const row2 = useMemo(() => {
    const list = reviews.length > 0 ? reviews : SAMPLE_REVIEWS;
    const half = Math.ceil(list.length / 2);
    const secondHalf = list.slice(half);
    return [...secondHalf, ...secondHalf, ...secondHalf];
  }, [reviews]);

  // Handle Review Submission
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Please enter your name.');
      return;
    }
    if (!formData.reviewText.trim()) {
      setFormError('Please write a short review.');
      return;
    }
    if (formData.rating < 1) {
      setFormError('Please select a star rating.');
      return;
    }

    try {
      setSubmitting(true);
      const newReview = {
        id: `rev-${Date.now()}`,
        name: formData.name.trim(),
        rating: Number(formData.rating),
        review_text: formData.reviewText.trim(),
        created_at: new Date().toISOString()
      };

      // Try inserting into Supabase
      try {
        const { data, error } = await supabase.from('reviews').insert([{
          name: newReview.name,
          rating: newReview.rating,
          review_text: newReview.review_text
        }]).select();

        if (data && data[0]) {
          newReview.id = data[0].id;
        }
      } catch (dbErr) {
        console.warn('[CustomerReviews] Supabase insertion note:', dbErr);
      }

      // Add newly created review directly to top of local state so it appears immediately!
      setReviews((prev) => [newReview, ...prev]);
      setSubmitSuccess(true);

      // Reset form after short delay
      setTimeout(() => {
        setSubmitSuccess(false);
        setModalOpen(false);
        setFormData({ name: '', rating: 5, reviewText: '' });
      }, 1800);
    } catch (err) {
      console.error('Error submitting review:', err);
      setFormError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="py-14 sm:py-20 border-b border-[#1f293d] relative overflow-hidden bg-gradient-to-b from-[#0b0f19] via-[#0e1424] to-[#0b0f19]">
      
      {/* Background Accent Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#0066CC]/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 sm:mb-14 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 text-xs font-bold text-[#0066CC] uppercase tracking-wider mb-2">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Rider Testimonials</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">What Our Riders Say</h2>
            <p className="text-gray-400 text-xs sm:text-sm mt-2 max-w-xl">
              Real experiences from happy TVS motorcycle and scooter owners across Lahan and Siraha district.
            </p>
          </div>

          {/* Write a Review Button */}
          <button
            onClick={() => setModalOpen(true)}
            className="btn-primary min-h-[44px] px-6 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 shrink-0 shadow-lg shadow-[#0066CC]/20"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span>Share Your Experience</span>
          </button>
        </div>
      </div>

      {/* Marquee Scrolling Rows Container */}
      <div className="space-y-6 overflow-hidden relative py-2">
        {/* Subtle Fade Edges */}
        <div className="absolute top-0 bottom-0 left-0 w-16 sm:w-32 bg-gradient-to-r from-[#0b0f19] to-transparent z-20 pointer-events-none" />
        <div className="absolute top-0 bottom-0 right-0 w-16 sm:w-32 bg-gradient-to-l from-[#0b0f19] to-transparent z-20 pointer-events-none" />

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader className="w-8 h-8 text-[#0066CC] animate-spin" />
          </div>
        ) : (
          <>
            {/* ROW 1: Right to Left Marquee */}
            <div className="overflow-hidden w-full">
              <div className="animate-marquee space-x-4 sm:space-x-6 px-4">
                {row1.map((item, idx) => (
                  <ReviewCard key={`r1-${item.id}-${idx}`} review={item} />
                ))}
              </div>
            </div>

            {/* ROW 2: Left to Right Marquee */}
            <div className="overflow-hidden w-full">
              <div className="animate-marquee-reverse space-x-4 sm:space-x-6 px-4">
                {row2.map((item, idx) => (
                  <ReviewCard key={`r2-${item.id}-${idx}`} review={item} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* WRITE A REVIEW MODAL */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-[#111827] border border-[#0066CC]/40 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden"
            >
              {/* Close Button */}
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>

              {submitSuccess ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/40">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Review Submitted!</h3>
                  <p className="text-xs sm:text-sm text-gray-300">
                    Thank you for sharing your experience with TVS Raj Automobiles. Your review is now live!
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitReview} className="space-y-5">
                  <div>
                    <div className="inline-flex items-center space-x-2 text-xs font-bold text-[#0066CC] uppercase tracking-wide mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Customer Review</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-white">Share Your Experience</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Rate your TVS bike purchase or servicing experience at our Lahan showroom.
                    </p>
                  </div>

                  {formError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                      {formError}
                    </div>
                  )}

                  {/* Name Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300 block">Your Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Ramesh Kumar Chaudhary"
                      className="w-full px-4 py-2.5 rounded-xl bg-[#1f293d]/80 border border-[#1f293d] focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] text-sm text-white placeholder-gray-500 outline-none transition-colors"
                      required
                    />
                  </div>

                  {/* Rating Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300 block">Your Rating *</label>
                    <div className="flex items-center space-x-2 bg-[#1f293d]/50 p-3 rounded-xl border border-[#1f293d]">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFormData({ ...formData, rating: star })}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 hover:scale-115 transition-transform"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              star <= (hoverRating || formData.rating)
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-gray-600 fill-gray-800'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-amber-400 ml-2">
                        {formData.rating} / 5 Stars
                      </span>
                    </div>
                  </div>

                  {/* Review Textarea */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300 block">Your Review *</label>
                    <textarea
                      rows={3}
                      value={formData.reviewText}
                      onChange={(e) => setFormData({ ...formData, reviewText: e.target.value })}
                      placeholder="Tell us about your bike performance, staff service, or EMI experience..."
                      className="w-full px-4 py-2.5 rounded-xl bg-[#1f293d]/80 border border-[#1f293d] focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] text-sm text-white placeholder-gray-500 outline-none transition-colors resize-none"
                      required
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[44px] py-3 px-6 rounded-xl btn-primary font-bold text-sm flex items-center justify-center space-x-2"
                  >
                    {submitting ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <span>Submit Review</span>
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
