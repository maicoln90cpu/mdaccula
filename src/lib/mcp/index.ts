import { defineMcp } from "@lovable.dev/mcp-js";
import listUpcomingEvents from "./tools/list_upcoming_events";
import getEvent from "./tools/get_event";
import listBlogPosts from "./tools/list_blog_posts";
import getBlogPost from "./tools/get_blog_post";
import listLinks from "./tools/list_links";

export default defineMcp({
  name: "mdaccula-mcp",
  title: "MDAccula MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas públicas da MDAccula (agência de música eletrônica em São Paulo). Use `list_upcoming_events` e `get_event` para eventos, `list_blog_posts` e `get_blog_post` para artigos do blog, e `list_links` para os links oficiais (Linktree). Todos os dados retornados são públicos.",
  tools: [listUpcomingEvents, getEvent, listBlogPosts, getBlogPost, listLinks],
});
