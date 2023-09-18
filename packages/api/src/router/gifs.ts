import { type AppBskyEmbedExternal, type BlobRef } from "@atproto/api";
import sharp from "sharp";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "../trpc";

const TENOR_API = "https://tenor.googleapis.com/v2";

async function fetchTenor<
  T =
    | TenorSearchAPIResponse
    | TenorFeaturedAPIResponse
    | TenorCategoriesAPIResponse
    | TenorSearchSuggestionsAPIResponse
    | TenorAutocompleteAPIResponse
    | TenorTrendingTermsAPIResponse
    | TenorRegisterShareAPIResponse
    | TenorPostsAPIResponse,
>(
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(TENOR_API + path);
  Object.keys(params).forEach((key) => {
    if (params[key] === undefined) delete params[key];
  });
  url.search = new URLSearchParams({
    ...params,
    key: process.env.GOOGLE_API_KEY!,
    client_key: "graysky",
  }).toString();
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Tenor API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const gifsRouter = createTRPCRouter({
  select: publicProcedure
    .input(
      z.object({
        id: z.string(),
        assetUrl: z.string(),
        previewUrl: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        token: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      void fetchTenor<TenorRegisterShareAPIResponse>("/registershare", {
        id: input.id,
      });

      // fetch preview image, which is a one frame gif, convert to to jpeg, and send to bsky.social

      const res = await fetch(input.previewUrl);
      const buffer = await res.arrayBuffer();

      const image = await sharp(buffer).toFormat("jpeg").toBuffer();

      const uploadRes = await fetch(
        "https://bsky.social/xrpc/com.atproto.repo.uploadBlob",
        {
          method: "POST",
          body: image,
          headers: {
            "Content-Type": "image/jpeg",
            Authorization: `Bearer ${input.token}`,
          },
        },
      );

      const blobRef = (await uploadRes.json()) as BlobRef;

      const title = "";
      const description = "";

      return {
        view: {
          $type: "app.bsky.embed.external#view",
          external: {
            $type: "app.bsky.embed.external#viewExternal",
            uri: input.assetUrl,
            title,
            description,
          },
        } satisfies AppBskyEmbedExternal.View,
        main: {
          $type: "app.bsky.embed.external#view",
          external: {
            $type: "app.bsky.embed.external#external",
            uri: input.assetUrl,
            title,
            description,
            thumb: blobRef,
          },
        } satisfies AppBskyEmbedExternal.Main,
      };
    }),
  tenor: createTRPCRouter({
    search: publicProcedure
      .input(
        z.object({
          query: z.string(),
          locale: z.string().optional(),
          limit: z.number().optional(),
          cursor: z.string().optional(),
        }),
      )
      .query(async ({ input }) => {
        return await fetchTenor<TenorSearchAPIResponse>("/search", {
          q: input.query,
          locale: input.locale,
          limit: input.limit,
          pos: input.cursor,
          mediafilter: "nanomp4,tinymp4,mp4,preview",
        });
      }),
    featured: publicProcedure
      .input(
        z.object({
          locale: z.string().optional(),
          limit: z.number().optional(),
          cursor: z.string().optional(),
        }),
      )
      .query(async ({ input }) => {
        return await fetchTenor<TenorFeaturedAPIResponse>("/featured", {
          locale: input.locale,
          limit: input.limit,
          pos: input.cursor,
          mediafilter: "nanomp4,tinymp4,mp4,preview",
        });
      }),
    categories: publicProcedure
      .input(
        z.object({
          type: z.enum(["featured", "trending"]).optional(),
          locale: z.string().optional(),
        }),
      )
      .query(async ({ input }) => {
        return await fetchTenor<TenorCategoriesAPIResponse>("/categories", {
          type: input.type,
          locale: input.locale,
        });
      }),
    searchSuggestions: publicProcedure
      .input(
        z.object({
          query: z.string(),
          locale: z.string().optional(),
        }),
      )
      .query(async ({ input }) => {
        return await fetchTenor<TenorSearchSuggestionsAPIResponse>(
          "/search_suggestions",
          {
            q: input.query,
            locale: input.locale,
          },
        );
      }),
    autocomplete: publicProcedure
      .input(
        z.object({
          query: z.string(),
          locale: z.string().optional(),
        }),
      )
      .query(async ({ input }) => {
        return await fetchTenor<TenorAutocompleteAPIResponse>("/autocomplete", {
          q: input.query,
          locale: input.locale,
        });
      }),
    trendingTerms: publicProcedure
      .input(
        z.object({
          locale: z.string().optional(),
        }),
      )
      .query(async ({ input }) => {
        return await fetchTenor<TenorTrendingTermsAPIResponse>(
          "/trending_terms",
          {
            locale: input.locale,
          },
        );
      }),
  }),
});

// tenor response types

export interface TenorResponse {
  created: number;
  hasaudio: boolean;
  id: string;
  media_formats: Record<TenorContentFormat, TenorMedia>;
  tags: string[];
  title: string;
  content_description: string;
  itemurl: string;
  hascaption: boolean;
  flags: string;
  bg_color?: string;
  url: string;
}

export interface TenorCategory {
  searchterm: string;
  path: string;
  image: string;
  name: string;
}

export interface TenorMedia {
  url: string;
  dims: number[];
  duration: number;
  size: number;
}

type TenorContentFormat =
  | "preview"
  | "gif"
  | "mediumgif"
  | "tinygif"
  | "nanogif"
  | "mp4"
  | "loopedmp4"
  | "tinymp4"
  | "nanomp4"
  | "webm"
  | "tinywebm"
  | "nanowebm"
  | "webp_transparent"
  | "tinywebp_transparent"
  | "nanowebp_transparent"
  | "gif_transparent"
  | "tinygif_transparent"
  | "nanogif_transparent";

interface TenorSearchAPIResponse {
  next: string;
  results: TenorResponse[];
}

interface TenorFeaturedAPIResponse {
  next: string;
  results: TenorResponse[];
}

interface TenorCategoriesAPIResponse {
  tags: TenorCategory[];
}

interface TenorSearchSuggestionsAPIResponse {
  results: string[];
}

interface TenorAutocompleteAPIResponse {
  results: string[];
}

interface TenorTrendingTermsAPIResponse {
  results: string[];
}

interface TenorPostsAPIResponse {
  results: TenorResponse[];
}

type TenorRegisterShareAPIResponse = undefined;