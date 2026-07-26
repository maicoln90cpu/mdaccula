import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getOptimizedImageUrl, getThumbnailUrl, handleThumbImageFallback } from '@/lib/imageUtils';
import type { RelatedBlogPost } from './types';

export function RelatedBlogPostCard({ post }: { post: RelatedBlogPost }) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle>📰 Artigo Relacionado</CardTitle>
        <CardDescription>Saiba mais sobre este evento no nosso blog</CardDescription>
      </CardHeader>
      <CardContent>
        <Link to={`/blog/${post.slug}`}>
          <div className="group cursor-pointer">
            {post.image_url && (
              <div className="w-full h-48 rounded-lg overflow-hidden mb-4">
                <img
                  src={getThumbnailUrl(post.image_url)}
                  alt={post.title}
                  className="w-full h-full object-contain"
                  loading="lazy"
                  decoding="async"
                  onError={(e) =>
                    handleThumbImageFallback(e, getOptimizedImageUrl(post.image_url))
                  }
                />
              </div>
            )}
            <Badge className="mb-2">{post.category}</Badge>
            <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
              {post.title}
            </h3>
            <p className="text-muted-foreground">{post.excerpt}</p>
            <Button variant="link" className="mt-2 p-0">
              Ler artigo completo →
            </Button>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
