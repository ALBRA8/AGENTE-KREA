/**
 * AI Gateway — única puerta de acceso al proveedor de generación para los
 * motores del Product Factory (product-fit, architecture, specification,
 * economics, content-engine, commercial-product, book-factory).
 *
 * Todo pasa por contracts/provider-registry → adapters → SDK.
 * Ningún motor instancia el SDK directamente.
 *
 * Devuelve una fachada mínima con la forma del SDK para mantener los
 * sitios de llamada sin cambios; la implementación real es el adapter.
 */

import { getProvider } from "@/contracts/provider-registry";

type ChatMessage = { role: string; content: string };

interface GatewayChatResponse {
  choices: Array<{ message: { content: string } }>;
}

interface GatewayImageResponse {
  data: Array<{ base64: string; url?: string }>;
}

export interface AiGateway {
  chat: {
    completions: {
      create(params: { messages: ChatMessage[] }): Promise<GatewayChatResponse>;
    };
  };
  images: {
    generations: {
      create(params: { prompt: string; size?: string; model?: string }): Promise<GatewayImageResponse>;
    };
  };
}

export function getAiGateway(): AiGateway {
  return {
    chat: {
      completions: {
        create: async ({ messages }) => {
          const result = await getProvider("text").generate({ messages });
          if (!result.success) {
            throw new Error(result.error || "Provider chat failed");
          }
          const content = (result.data as { content?: string })?.content ?? "";
          return { choices: [{ message: { content } }] };
        },
      },
    },
    images: {
      generations: {
        create: async ({ prompt, size }) => {
          const result = await getProvider("image").generate({ prompt, size });
          if (!result.success) {
            throw new Error(result.error || "Provider image failed");
          }
          const data = (result.data as { base64?: string; url?: string }) ?? {};
          return { data: [{ base64: data.base64 ?? "", url: data.url }] };
        },
      },
    },
  };
}
