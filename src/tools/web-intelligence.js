const cheerio = require('cheerio');

class WebIntelligence {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  }

  /**
   * Search DuckDuckGo HTML and parse top results.
   */
  async webSearch(query, maxResults = 5) {
    try {
      if (!query || typeof query !== 'string') {
        return {
          success: false,
          error: "Query string is required"
        };
      }

      const encoded = encodeURIComponent(query.trim());
      // DuckDuckGo HTML search endpoint
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encoded}`;

      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'User-Agent': this.userAgent,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        body: `q=${encoded}&b=`
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Search request failed with HTTP ${response.status}: ${response.statusText}`
        };
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const results = [];

      $('.result').each((i, el) => {
        if (results.length >= maxResults) return false;

        const titleEl = $(el).find('.result__title .result__a');
        const snippetEl = $(el).find('.result__snippet');
        const rawUrl = titleEl.attr('href');

        if (!titleEl.text() || !rawUrl) return;

        // Unpack DuckDuckGo redirect URL /uddg?uddg=...
        let finalUrl = rawUrl;
        if (rawUrl.includes('/l/?uddg=')) {
          try {
            const parsed = new URL('https://duckduckgo.com' + rawUrl);
            finalUrl = decodeURIComponent(parsed.searchParams.get('uddg') || rawUrl);
          } catch (e) {
            // Keep rawUrl
          }
        } else if (rawUrl.startsWith('//')) {
          finalUrl = 'https:' + rawUrl;
        }

        results.push({
          title: titleEl.text().trim(),
          url: finalUrl,
          snippet: snippetEl.text().trim()
        });
      });

      if (results.length === 0) {
        return {
          success: true,
          query: query,
          results: [],
          message: "No results found or search query returned empty."
        };
      }

      return {
        success: true,
        query: query,
        total: results.length,
        results: results
      };
    } catch (err) {
      return {
        success: false,
        error: `DuckDuckGo search error: ${err.message}`
      };
    }
  }

  /**
   * Scrapes webpage, strips boilerplate/navigation, and returns extracted text.
   */
  async scrapeWebpage(targetUrl, maxChars = 4500) {
    try {
      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        return {
          success: false,
          error: "Invalid or unsupported URL protocol. URL must start with http:// or https://"
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          success: false,
          error: `Failed to fetch webpage (HTTP ${res.status} ${res.statusText})`
        };
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      // Clean up ads, scripts, tags that add clutter
      $('script, style, noscript, nav, header, footer, aside, iframe, svg, [role="banner"], [role="navigation"], .ads, .ad, .social-share').remove();

      const pageTitle = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled Webpage';

      // Prioritize main content containers if available
      let contentRoot = $('main, article, #content, .content, .post-content, #main');
      if (contentRoot.length === 0) {
        contentRoot = $('body');
      }

      // Convert paragraphs, headings, list items to readable lines
      let text = '';
      contentRoot.find('h1, h2, h3, h4, h5, h6, p, li, pre, code').each((_, el) => {
        const line = $(el).text().replace(/\s+/g, ' ').trim();
        if (line) {
          text += line + '\n\n';
        }
      });

      if (!text.trim()) {
        text = contentRoot.text().replace(/\s+/g, ' ').trim();
      }

      let truncated = false;
      let finalContent = text.trim();
      if (finalContent.length > maxChars) {
        finalContent = finalContent.substring(0, maxChars) + '\n\n... [Content truncated for token efficiency]';
        truncated = true;
      }

      return {
        success: true,
        url: targetUrl,
        title: pageTitle,
        truncated: truncated,
        characterCount: finalContent.length,
        content: finalContent
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          error: `Scraping timed out after 15 seconds for ${targetUrl}`
        };
      }
      return {
        success: false,
        error: `Scrape error: ${err.message}`
      };
    }
  }
}

module.exports = { WebIntelligence };
