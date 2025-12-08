const BASE_URL = "https://api.mangadex.org";

export interface Manga {
  id: string;
  title: string;
  description: string;
  status: string;
  year: number | null;
  type: "Manga" | "Manhwa" | "Manhua";
  tags: string[];
  author: string;
  coverUrl: string | null;
}

export interface Chapter {
  id: string;
  title: string;
  chapter: string;
  volume: string | null;
  pages: number;
  publishedAt: string;
}

export interface ChapterPages {
  hash: string;
  pages: string[];
}

export interface MangaTag {
  id: string;
  name: string;
  group: "genre" | "theme" | "format" | "content";
}

export type SortOption = "relevance" | "latestUploadedChapter" | "followedCount" | "createdAt" | "rating";

export interface SearchFilters {
  includedTags: string[];
  excludedTags: string[];
  status: string[];
  sortBy: SortOption;
}

const extractTitle = (attributes: any): string => {
  const titles = attributes.title;
  return (
    titles?.en ||
    titles?.ja ||
    titles?.["ja-ro"] ||
    Object.values(titles || {})[0] ||
    "Unknown"
  ) as string;
};

const extractDescription = (attributes: any): string => {
  const descriptions = attributes.description;
  return (
    descriptions?.en ||
    descriptions?.ja ||
    Object.values(descriptions || {})[0] ||
    "No description available"
  ) as string;
};

const getType = (originalLanguage: string): "Manga" | "Manhwa" | "Manhua" => {
  if (originalLanguage === "ko") return "Manhwa";
  if (originalLanguage === "zh" || originalLanguage === "zh-hk") return "Manhua";
  return "Manga";
};

const getCoverUrl = (mangaId: string, coverFilename: string | null, size: number = 256): string | null => {
  if (!coverFilename) return null;
  return `https://uploads.mangadex.org/covers/${mangaId}/${coverFilename}.${size}.jpg`;
};

let cachedTags: MangaTag[] | null = null;

export const mangadexApi = {
  async getTags(): Promise<MangaTag[]> {
    if (cachedTags) return cachedTags;
    
    try {
      const response = await fetch(`${BASE_URL}/manga/tag`);
      if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);
      
      const data = await response.json();
      const tags: MangaTag[] = (data.data || []).map((tag: any) => ({
        id: tag.id,
        name: tag.attributes?.name?.en || Object.values(tag.attributes?.name || {})[0] || "Unknown",
        group: tag.attributes?.group || "genre",
      }));
      
      tags.sort((a, b) => a.name.localeCompare(b.name));
      cachedTags = tags;
      return tags;
    } catch (error) {
      console.error("Failed to fetch tags:", error);
      return [];
    }
  },

  async searchManga(
    query: string,
    limit: number = 40,
    options: { 
      status?: string; 
      originalLanguage?: string; 
      adultMode?: boolean; 
      languages?: string[];
      filters?: SearchFilters;
    } = {}
  ): Promise<{ data: Manga[]; total: number }> {
    const sortBy = options.filters?.sortBy || "relevance";
    const sortOrder = "desc";
    
    const params = new URLSearchParams({
      limit: limit.toString(),
      "includes[]": "cover_art",
    });

    if (query) {
      params.append("title", query);
    }

    params.append(`order[${sortBy}]`, sortOrder);

    if (options.filters?.status && options.filters.status.length > 0) {
      options.filters.status.forEach(s => {
        params.append("status[]", s);
      });
    } else if (options.status) {
      params.append("status[]", options.status);
    }

    if (options.originalLanguage) {
      params.append("originalLanguage[]", options.originalLanguage);
    }

    if (options.languages && options.languages.length > 0) {
      options.languages.forEach(lang => {
        params.append("availableTranslatedLanguage[]", lang);
      });
    }

    if (options.filters?.includedTags && options.filters.includedTags.length > 0) {
      options.filters.includedTags.forEach(tagId => {
        params.append("includedTags[]", tagId);
      });
    }

    if (options.filters?.excludedTags && options.filters.excludedTags.length > 0) {
      options.filters.excludedTags.forEach(tagId => {
        params.append("excludedTags[]", tagId);
      });
    }

    if (options.adultMode) {
      params.append("contentRating[]", "erotica");
      params.append("contentRating[]", "pornographic");
    } else {
      params.append("contentRating[]", "safe");
      params.append("contentRating[]", "suggestive");
    }

    const response = await fetch(`${BASE_URL}/manga?${params}`);
    if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);

    const data = await response.json();
    return {
      data: formatMangaList(data.data || []),
      total: data.total || 0,
    };
  },

  async getPopularManga(limit: number = 40, adultMode: boolean = false, languages: string[] = []): Promise<{ data: Manga[]; total: number }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      "includes[]": "cover_art",
      "order[followedCount]": "desc",
    });

    if (languages.length > 0) {
      languages.forEach(lang => {
        params.append("availableTranslatedLanguage[]", lang);
      });
    }

    if (adultMode) {
      params.append("contentRating[]", "erotica");
      params.append("contentRating[]", "pornographic");
    } else {
      params.append("contentRating[]", "safe");
      params.append("contentRating[]", "suggestive");
    }

    const response = await fetch(`${BASE_URL}/manga?${params}`);
    if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);

    const data = await response.json();
    return {
      data: formatMangaList(data.data || []),
      total: data.total || 0,
    };
  },

  async getRandomManga(limit: number = 40, adultMode: boolean = false, languages: string[] = [], filters?: SearchFilters): Promise<{ data: Manga[]; total: number }> {
    const sortBy = filters?.sortBy || "followedCount";
    const baseParams = new URLSearchParams({
      limit: "1",
      "includes[]": "cover_art",
    });

    if (languages.length > 0) {
      languages.forEach(lang => {
        baseParams.append("availableTranslatedLanguage[]", lang);
      });
    }

    if (filters?.includedTags && filters.includedTags.length > 0) {
      filters.includedTags.forEach(tagId => {
        baseParams.append("includedTags[]", tagId);
      });
    }

    if (filters?.excludedTags && filters.excludedTags.length > 0) {
      filters.excludedTags.forEach(tagId => {
        baseParams.append("excludedTags[]", tagId);
      });
    }

    if (filters?.status && filters.status.length > 0) {
      filters.status.forEach(s => {
        baseParams.append("status[]", s);
      });
    }

    if (adultMode) {
      baseParams.append("contentRating[]", "erotica");
      baseParams.append("contentRating[]", "pornographic");
    } else {
      baseParams.append("contentRating[]", "safe");
      baseParams.append("contentRating[]", "suggestive");
    }

    const countResponse = await fetch(`${BASE_URL}/manga?${baseParams}`);
    if (!countResponse.ok) throw new Error(`MangaDex API error: ${countResponse.status}`);
    const countData = await countResponse.json();
    const total = countData.total || 0;

    const maxOffset = Math.max(0, total - limit);
    const randomOffset = maxOffset > 0 ? Math.floor(Math.random() * Math.min(maxOffset, 500)) : 0;
    
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: randomOffset.toString(),
      "includes[]": "cover_art",
      [`order[${sortBy}]`]: "desc",
    });

    if (languages.length > 0) {
      languages.forEach(lang => {
        params.append("availableTranslatedLanguage[]", lang);
      });
    }

    if (filters?.includedTags && filters.includedTags.length > 0) {
      filters.includedTags.forEach(tagId => {
        params.append("includedTags[]", tagId);
      });
    }

    if (filters?.excludedTags && filters.excludedTags.length > 0) {
      filters.excludedTags.forEach(tagId => {
        params.append("excludedTags[]", tagId);
      });
    }

    if (filters?.status && filters.status.length > 0) {
      filters.status.forEach(s => {
        params.append("status[]", s);
      });
    }

    if (adultMode) {
      params.append("contentRating[]", "erotica");
      params.append("contentRating[]", "pornographic");
    } else {
      params.append("contentRating[]", "safe");
      params.append("contentRating[]", "suggestive");
    }

    const response = await fetch(`${BASE_URL}/manga?${params}`);
    if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);

    const data = await response.json();
    const mangaList = formatMangaList(data.data || []);
    
    const shuffled = [...mangaList].sort(() => Math.random() - 0.5);
    
    return {
      data: shuffled,
      total: total,
    };
  },

  async getLatestUpdates(limit: number = 40, adultMode: boolean = false, languages: string[] = []): Promise<{ data: Manga[]; total: number }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      "includes[]": "cover_art",
      "order[latestUploadedChapter]": "desc",
    });

    if (languages.length > 0) {
      languages.forEach(lang => {
        params.append("availableTranslatedLanguage[]", lang);
      });
    }

    if (adultMode) {
      params.append("contentRating[]", "erotica");
      params.append("contentRating[]", "pornographic");
    } else {
      params.append("contentRating[]", "safe");
      params.append("contentRating[]", "suggestive");
    }

    const response = await fetch(`${BASE_URL}/manga?${params}`);
    if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);

    const data = await response.json();
    return {
      data: formatMangaList(data.data || []),
      total: data.total || 0,
    };
  },

  async getManga(limit: number = 40, adultMode: boolean = false, languages: string[] = []): Promise<{ data: Manga[]; total: number }> {
    const baseParams = new URLSearchParams({
      limit: "1",
      "includes[]": "cover_art",
      "originalLanguage[]": "ja",
    });

    if (languages.length > 0) {
      languages.forEach(lang => {
        baseParams.append("availableTranslatedLanguage[]", lang);
      });
    }

    if (adultMode) {
      baseParams.append("contentRating[]", "erotica");
      baseParams.append("contentRating[]", "pornographic");
    } else {
      baseParams.append("contentRating[]", "safe");
      baseParams.append("contentRating[]", "suggestive");
    }

    const countResponse = await fetch(`${BASE_URL}/manga?${baseParams}`);
    if (!countResponse.ok) throw new Error(`MangaDex API error: ${countResponse.status}`);
    const countData = await countResponse.json();
    const total = countData.total || 0;

    const maxOffset = Math.max(0, total - limit);
    const randomOffset = maxOffset > 0 ? Math.floor(Math.random() * Math.min(maxOffset, 300)) : 0;

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: randomOffset.toString(),
      "includes[]": "cover_art",
      "originalLanguage[]": "ja",
      "order[followedCount]": "desc",
    });

    if (languages.length > 0) {
      languages.forEach(lang => {
        params.append("availableTranslatedLanguage[]", lang);
      });
    }

    if (adultMode) {
      params.append("contentRating[]", "erotica");
      params.append("contentRating[]", "pornographic");
    } else {
      params.append("contentRating[]", "safe");
      params.append("contentRating[]", "suggestive");
    }

    const response = await fetch(`${BASE_URL}/manga?${params}`);
    if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);

    const data = await response.json();
    return {
      data: formatMangaList(data.data || []),
      total: data.total || 0,
    };
  },

  async getManhwa(limit: number = 40, adultMode: boolean = false, languages: string[] = []): Promise<{ data: Manga[]; total: number }> {
    const baseParams = new URLSearchParams({
      limit: "1",
      "includes[]": "cover_art",
      "originalLanguage[]": "ko",
    });

    if (languages.length > 0) {
      languages.forEach(lang => {
        baseParams.append("availableTranslatedLanguage[]", lang);
      });
    }

    if (adultMode) {
      baseParams.append("contentRating[]", "erotica");
      baseParams.append("contentRating[]", "pornographic");
    } else {
      baseParams.append("contentRating[]", "safe");
      baseParams.append("contentRating[]", "suggestive");
    }

    const countResponse = await fetch(`${BASE_URL}/manga?${baseParams}`);
    if (!countResponse.ok) throw new Error(`MangaDex API error: ${countResponse.status}`);
    const countData = await countResponse.json();
    const total = countData.total || 0;

    const maxOffset = Math.max(0, total - limit);
    const randomOffset = maxOffset > 0 ? Math.floor(Math.random() * Math.min(maxOffset, 300)) : 0;

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: randomOffset.toString(),
      "includes[]": "cover_art",
      "originalLanguage[]": "ko",
      "order[followedCount]": "desc",
    });

    if (languages.length > 0) {
      languages.forEach(lang => {
        params.append("availableTranslatedLanguage[]", lang);
      });
    }

    if (adultMode) {
      params.append("contentRating[]", "erotica");
      params.append("contentRating[]", "pornographic");
    } else {
      params.append("contentRating[]", "safe");
      params.append("contentRating[]", "suggestive");
    }

    const response = await fetch(`${BASE_URL}/manga?${params}`);
    if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);

    const data = await response.json();
    const manhwaList = formatMangaList(data.data || []);
    
    const shuffled = [...manhwaList].sort(() => Math.random() - 0.5);
    
    return {
      data: shuffled,
      total: total,
    };
  },

  async getManhua(limit: number = 40, adultMode: boolean = false, languages: string[] = []): Promise<{ data: Manga[]; total: number }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      "includes[]": "cover_art",
      "originalLanguage[]": "zh",
      "order[followedCount]": "desc",
    });

    if (languages.length > 0) {
      languages.forEach(lang => {
        params.append("availableTranslatedLanguage[]", lang);
      });
    }

    if (adultMode) {
      params.append("contentRating[]", "erotica");
      params.append("contentRating[]", "pornographic");
    } else {
      params.append("contentRating[]", "safe");
      params.append("contentRating[]", "suggestive");
    }

    const response = await fetch(`${BASE_URL}/manga?${params}`);
    if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);

    const data = await response.json();
    return {
      data: formatMangaList(data.data || []),
      total: data.total || 0,
    };
  },

  async getMangaDetails(mangaId: string): Promise<Manga | null> {
    const params = new URLSearchParams();
    params.append("includes[]", "cover_art");
    params.append("includes[]", "author");
    params.append("includes[]", "artist");

    const response = await fetch(`${BASE_URL}/manga/${mangaId}?${params}`);
    if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);

    const data = await response.json();
    if (!data.data) return null;

    return formatMangaDetails(data.data);
  },

  async getChapters(mangaId: string, languages: string | string[] = "en", adultMode: boolean = false): Promise<Chapter[]> {
    const langArray = Array.isArray(languages) ? languages : [languages];
    let allChapters: Chapter[] = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;

    while (hasMore && offset < 5000) {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        "order[chapter]": "asc",
      });

      langArray.forEach(lang => {
        params.append("translatedLanguage[]", lang);
      });

      if (adultMode) {
        params.append("contentRating[]", "erotica");
        params.append("contentRating[]", "pornographic");
      } else {
        params.append("contentRating[]", "safe");
        params.append("contentRating[]", "suggestive");
        params.append("contentRating[]", "erotica");
      }

      const response = await fetch(`${BASE_URL}/manga/${mangaId}/feed?${params}`);
      if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);

      const data = await response.json();

      if (data.data && data.data.length > 0) {
        allChapters = allChapters.concat(formatChapterList(data.data));
        offset += limit;
        hasMore = data.data.length === limit;
      } else {
        hasMore = false;
      }
    }

    const uniqueChapters: Chapter[] = [];
    const seenChapters = new Set<string>();

    for (const ch of allChapters) {
      const key = ch.chapter;
      if (!seenChapters.has(key)) {
        seenChapters.add(key);
        uniqueChapters.push(ch);
      }
    }

    uniqueChapters.sort((a, b) => {
      const numA = parseFloat(a.chapter) || 0;
      const numB = parseFloat(b.chapter) || 0;
      return numA - numB;
    });

    return uniqueChapters;
  },

  async getChapterPages(chapterId: string, dataSaver: boolean = false): Promise<ChapterPages> {
    const response = await fetch(`${BASE_URL}/at-home/server/${chapterId}`);
    if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);

    const data = await response.json();

    if (!data.baseUrl || !data.chapter) {
      throw new Error("Invalid chapter data received");
    }

    const baseUrl = data.baseUrl;
    const chapter = data.chapter;

    const quality = dataSaver ? "data-saver" : "data";
    const imageData = dataSaver && chapter.dataSaver ? chapter.dataSaver : chapter.data;

    if (!imageData || !Array.isArray(imageData) || imageData.length === 0) {
      throw new Error("No page data found in chapter");
    }

    const pages = imageData.map((filename: string) => 
      `${baseUrl}/${quality}/${chapter.hash}/${filename}`
    );

    return {
      pages,
      hash: chapter.hash,
    };
  },

  getPageUrl(baseUrl: string, hash: string, filename: string, quality: "data" | "data-saver" = "data-saver"): string {
    return `${baseUrl}/${quality}/${hash}/${filename}`;
  },

  async getSimilarManga(mangaId: string, limit: number = 10, adultMode: boolean = false): Promise<Manga[]> {
    try {
      const mangaResponse = await fetch(`${BASE_URL}/manga/${mangaId}`);
      if (!mangaResponse.ok) return [];
      
      const mangaData = await mangaResponse.json();
      const rawTags = mangaData.data?.attributes?.tags || [];
      const genreTags = rawTags
        .filter((t: any) => t.attributes?.group === "genre" || t.attributes?.group === "theme")
        .slice(0, 3)
        .map((t: any) => t.id);

      if (genreTags.length === 0) {
        return [];
      }

      const params = new URLSearchParams({
        limit: (limit + 5).toString(),
        "includes[]": "cover_art",
        "order[followedCount]": "desc",
      });

      genreTags.forEach((tagId: string) => {
        params.append("includedTags[]", tagId);
      });

      if (adultMode) {
        params.append("contentRating[]", "erotica");
        params.append("contentRating[]", "pornographic");
      } else {
        params.append("contentRating[]", "safe");
        params.append("contentRating[]", "suggestive");
      }

      const response = await fetch(`${BASE_URL}/manga?${params}`);
      if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);

      const data = await response.json();
      const mangaList = formatMangaList(data.data || []);
      
      const filtered = mangaList.filter(m => m.id !== mangaId);
      return filtered.slice(0, limit);
    } catch (error) {
      console.error("Failed to fetch similar manga:", error);
      return [];
    }
  },
};

function formatMangaList(mangaList: any[]): Manga[] {
  if (!mangaList) return [];
  return mangaList.map((manga) => {
    const coverArt = manga.relationships?.find((r: any) => r.type === "cover_art");
    const coverFilename = coverArt?.attributes?.fileName || "";
    const originalLang = manga.attributes.originalLanguage;

    return {
      id: manga.id,
      title: extractTitle(manga.attributes),
      description: extractDescription(manga.attributes),
      coverUrl: getCoverUrl(manga.id, coverFilename, 256),
      status: manga.attributes.status,
      type: getType(originalLang),
      year: manga.attributes.year,
      tags: (manga.attributes.tags || []).map(
        (t: any) => t.attributes?.name?.en || Object.values(t.attributes?.name || {})[0] || "Unknown"
      ),
      author: "Unknown",
    };
  });
}

function formatMangaDetails(manga: any): Manga {
  const coverArt = manga.relationships?.find((r: any) => r.type === "cover_art");
  const author = manga.relationships?.find((r: any) => r.type === "author");
  const coverFilename = coverArt?.attributes?.fileName || "";
  const originalLang = manga.attributes.originalLanguage;

  return {
    id: manga.id,
    title: extractTitle(manga.attributes),
    description: extractDescription(manga.attributes),
    coverUrl: getCoverUrl(manga.id, coverFilename, 512),
    author: author?.attributes?.name || "Unknown",
    status: manga.attributes.status,
    type: getType(originalLang),
    year: manga.attributes.year,
    tags: (manga.attributes.tags || []).map(
      (t: any) => t.attributes?.name?.en || Object.values(t.attributes?.name || {})[0] || "Unknown"
    ),
  };
}

function formatChapterList(chapters: any[]): Chapter[] {
  if (!chapters) return [];
  return chapters
    .filter((chapter) => {
      const hasExternalUrl = chapter.attributes.externalUrl;
      const hasPages = chapter.attributes.pages > 0;
      return !hasExternalUrl && hasPages;
    })
    .map((chapter) => ({
      id: chapter.id,
      chapter: chapter.attributes.chapter || "0",
      title: chapter.attributes.title || `Chapter ${chapter.attributes.chapter || "?"}`,
      volume: chapter.attributes.volume,
      pages: chapter.attributes.pages,
      publishedAt: chapter.attributes.publishAt,
    }));
}
