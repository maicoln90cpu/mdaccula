import { useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { SEOHead } from '@/components/SEOHead';
import Navigation from '@/components/ui/navigation';
import Footer from '@/components/ui/footer';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <SEOHead
        title="Página não encontrada"
        description="A página que você procura não existe."
        noindex
      />
      <Navigation />
      <main id="main-content" className="pt-16 flex min-h-[70vh] items-center justify-center">
        <div className="text-center px-4">
          <h1 className="mb-4 text-6xl sm:text-7xl font-bold font-display hero-text">404</h1>
          <p className="mb-8 text-lg sm:text-xl text-muted-foreground">
            Essa página não existe ou foi movida.
          </p>
          <Button asChild size="lg" className="btn-neon">
            <Link to="/">Voltar para o início</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
