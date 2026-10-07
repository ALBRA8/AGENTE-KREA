import { describe, it, expect } from 'vitest';
import { checkOfferIntegrity } from '@/lib/offer-architecture';
import type { OfferArchitecture } from '@/lib/offer-architecture';

describe('OfferArchitecture - Integrity', () => {
  function makeHonestOffer(): OfferArchitecture {
    return {
      offerId: 'offer-1',
      productId: 'prod-1',
      problem: { content: 'People struggle with X', evidence: 'INFERRED', source: 'product_brain', warnings: [] },
      promise: { content: 'This guide helps you solve X step by step', evidence: 'INFERRED', source: 'value_proposition', warnings: [] },
      product: { content: 'A comprehensive guide', evidence: 'VERIFIED', source: 'product_definition', warnings: [] },
      mechanism: { content: 'Follow the 5-step framework', evidence: 'VERIFIED', source: 'product_content', warnings: [] },
      proof: { content: 'Framework based on research', evidence: 'INFERRED', source: 'product_brain', warnings: ['No user testimonials yet'] },
      price: { content: '$29 for the guide', evidence: 'ESTIMATED', source: 'price_strategy', warnings: [] },
      riskReduction: { content: 'See sample chapter before purchase', evidence: 'VERIFIED', source: 'delivery_plan', warnings: [] },
      cta: { content: 'Get the guide', evidence: 'INFERRED', source: 'marketing', warnings: [] },
      integrityCheck: { hasFakeTestimonials: false, hasInventedData: false, hasFalseAuthority: false, hasFalseScarcity: false, hasGuaranteedResults: false, passesIntegrity: true, issues: [] },
      evidence: 'INFERRED',
    };
  }

  it('should pass integrity for honest offer', () => {
    const offer = makeHonestOffer();
    const check = checkOfferIntegrity(offer);
    expect(check.passesIntegrity).toBe(true);
    expect(check.issues).toHaveLength(0);
  });

  it('should detect fake testimonials', () => {
    const offer = makeHonestOffer();
    offer.promise.content = 'Thousands of customers love our product and swear by it';
    const check = checkOfferIntegrity(offer);
    expect(check.hasFakeTestimonials).toBe(true);
    expect(check.passesIntegrity).toBe(false);
  });

  it('should detect invented statistics', () => {
    const offer = makeHonestOffer();
    offer.proof.content = '97% of users report success';
    const check = checkOfferIntegrity(offer);
    expect(check.hasInventedData).toBe(true);
  });

  it('should detect guaranteed results', () => {
    const offer = makeHonestOffer();
    offer.promise.content = 'This will guarantee your success';
    const check = checkOfferIntegrity(offer);
    expect(check.hasGuaranteedResults).toBe(true);
  });

  it('should detect false authority', () => {
    const offer = makeHonestOffer();
    offer.proof.content = 'The world leading expert in business growth recommends this';
    const check = checkOfferIntegrity(offer);
    expect(check.hasFalseAuthority).toBe(true);
  });

  it('should detect false scarcity', () => {
    const offer = makeHonestOffer();
    offer.cta.content = 'Limited time offer! Only 3 left! Act now!';
    const check = checkOfferIntegrity(offer);
    expect(check.hasFalseScarcity).toBe(true);
  });
});
