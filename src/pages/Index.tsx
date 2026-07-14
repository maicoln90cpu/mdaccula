import Navigation from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import Hero from "@/components/sections/Hero";
import FeaturedEvents from "@/components/sections/FeaturedEvents";
import LatestNews from "@/components/sections/LatestNews";
import { SEOHead } from "@/components/SEOHead";
import { StructuredData } from "@/components/StructuredData";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const Index = () => {
  const { settings } = useSiteSettings();

  return (
    <>
      <SEOHead
        title="DJ e Eventos de Música Eletrônica em SP"
        description="A maior agência de música eletrônica de São Paulo. Eventos, festas techno, house e underground. Contrate DJ profissional para seus eventos em SP."
        keywords={[
          'dj são paulo',
          'techno sp',
          'eventos eletrônicos',
          'festas underground 2025',
          'contratar dj techno sp',
          'house music são paulo',
          'baladas sp',
          'festas techno são paulo'
        ]}
        url="https://mdaccula.com"
      />
      <StructuredData type="website" />
      <StructuredData
        type="organization"
        data={{
          instagram_link: settings.instagram_link,
          soundcloud_link: settings.soundcloud_link
        }}
      />
      
      <div className="min-h-screen">
        <Navigation />
        <main>
          <Hero />
          <FeaturedEvents />
          <LatestNews />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
