import { describe, it, expect, beforeEach } from 'vitest';
import {
  submitFeedback,
  analyzeFeedback,
  getFeedbackSummary,
  clearFeedback,
} from '@/lib/commercial-feedback';

describe('CommercialFeedback', () => {
  beforeEach(() => {
    clearFeedback();
  });

  it('should submit feedback with correct type and category', () => {
    const fb = submitFeedback('prod-1', '1.0.0', 'POSITIVE', 'CONTENT', 'Great content, very useful', 'user_review');
    expect(fb.productId).toBe('prod-1');
    expect(fb.feedbackType).toBe('POSITIVE');
    expect(fb.category).toBe('CONTENT');
    expect(fb.analyzed).toBe(false);
  });

  it('should analyze positive feedback', () => {
    const fb = submitFeedback('prod-1', '1.0.0', 'POSITIVE', 'CONTENT', 'Excellent guide', 'review');
    const analyzed = analyzeFeedback(fb.feedbackId);
    expect(analyzed.analyzed).toBe(true);
    expect(analyzed.analysis?.sentiment).toBe('POSITIVE');
  });

  it('should analyze objection with HIGH priority', () => {
    const fb = submitFeedback('prod-1', '1.0.0', 'OBJECTION', 'PRICE', 'Too expensive for what it offers', 'survey');
    const analyzed = analyzeFeedback(fb.feedbackId);
    expect(analyzed.analysis?.priority).toBe('HIGH');
    expect(analyzed.analysis?.actionable).toBe(true);
  });

  it('should analyze feature request with MEDIUM priority', () => {
    const fb = submitFeedback('prod-1', '1.0.0', 'FEATURE_REQUEST', 'PRODUCT', 'Would love an audio version', 'feedback');
    const analyzed = analyzeFeedback(fb.feedbackId);
    expect(analyzed.analysis?.priority).toBe('MEDIUM');
    expect(analyzed.analysis?.actionable).toBe(true);
  });

  it('should analyze content gap with HIGH priority', () => {
    const fb = submitFeedback('prod-1', '1.0.0', 'CONTENT_GAP', 'CONTENT', 'Missing chapter on advanced topics', 'support');
    const analyzed = analyzeFeedback(fb.feedbackId);
    expect(analyzed.analysis?.priority).toBe('HIGH');
    expect(analyzed.analysis?.sentiment).toBe('NEGATIVE');
  });

  it('should analyze purchase barrier with HIGH priority', () => {
    const fb = submitFeedback('prod-1', '1.0.0', 'PURCHASE_BARRIER', 'PRICE', 'No payment options available', 'support');
    const analyzed = analyzeFeedback(fb.feedbackId);
    expect(analyzed.analysis?.priority).toBe('HIGH');
  });

  it('should compute feedback summary', () => {
    submitFeedback('prod-summary', '1.0.0', 'POSITIVE', 'CONTENT', 'Good', 'r1');
    submitFeedback('prod-summary', '1.0.0', 'NEGATIVE', 'DESIGN', 'Bad', 'r2');
    submitFeedback('prod-summary', '1.0.0', 'OBJECTION', 'PRICE', 'Expensive', 'r3');
    const summary = getFeedbackSummary('prod-summary');
    expect(summary.positive).toBeGreaterThanOrEqual(1);
    expect(summary.negative).toBeGreaterThanOrEqual(1);
  });
});
