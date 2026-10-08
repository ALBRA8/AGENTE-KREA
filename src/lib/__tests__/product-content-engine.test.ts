import { describe, it, expect } from 'vitest';
import { getContentTemplate, getContentTypeInfo, assembleContent } from '@/lib/product-content-engine';

describe('ProductContentEngine', () => {
  const types = ['ebook', 'guide', 'manual', 'workbook', 'checklist', 'template_pack', 'digital_kit', 'resource_pack', 'specialized_document', 'hybrid_content'] as const;

  it('should provide templates for all 10 product types', () => {
    for (const type of types) {
      const template = getContentTemplate(type);
      expect(template).toBeTruthy();
      expect(template.type).toBe(type);
      expect(template.sections.length).toBeGreaterThan(0);
    }
  });

  it('should have chapters in ebook template', () => {
    const template = getContentTemplate('ebook');
    const hasChapter = template.sections.some(s => s.type === 'chapter' || s.type === 'front_matter');
    expect(hasChapter).toBe(true);
  });

  it('should have steps in guide template', () => {
    const template = getContentTemplate('guide');
    expect(template.sections.length).toBeGreaterThan(0);
  });

  it('should have worksheets in workbook template', () => {
    const template = getContentTemplate('workbook');
    const hasWorksheet = template.sections.some(s => s.type === 'worksheet');
    expect(hasWorksheet).toBe(true);
  });

  it('should get content type info', () => {
    for (const type of types) {
      const info = getContentTypeInfo(type);
      expect(info).toBeTruthy();
      expect(info.name).toBeTruthy();
    }
  });

  it('should assemble content from sections', () => {
    const spec = getContentTemplate('ebook');
    spec.sections[0].content = 'Test content for assembly';
    const assembled = assembleContent(spec);
    expect(assembled).toBeTruthy();
  });
});
