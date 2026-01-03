
import Hero from '@/components/hero/Hero';
import Vision from '@/components/vision/Vision';
import Services from '@/components/services/Services';
import Rental from '@/components/rental/Rental';
import Salary from '@/components/salary/Salary';
import Parallax from '@/components/parallax/Parallax';
import Numbers from '@/components/numbers/Numbers';
import Testimonials from '@/components/testimonials/Testimonials';
import Footer from '@/components/footer/Footer';
import PartTime from '@/components/PartTime/PartTime';
export default function HomePage() {
  return (
    <>
  
      <Hero />
      <Vision />
      <Services />
      <Rental />
      <PartTime/>
      <Salary />
      <Parallax />
      <Numbers />
     <Testimonials items={[]} autoplay interval={3500} />
      <Footer />
    </>
  );
}
