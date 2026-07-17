import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HeliosStandard from "./components/HeliosStandard";
import WorkShowcase from "./components/work/WorkShowcase";
import OurApproach from "./components/OurApproach";
import TrustedBy from "./components/TrustedBy";
import InTheirWords from "./components/InTheirWords";
import PrimaryConversion from "./components/PrimaryConversion";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <HeliosStandard />
      <WorkShowcase />
      <OurApproach />
      <TrustedBy />
      <InTheirWords />
      <PrimaryConversion />
      <Footer />
    </main>
  );
}