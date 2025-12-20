import Blogsection from "../components/Blogsection";
import FAQ from "../components/FAQ";
import Footer from "../components/Footer";
import Herosection from "../components/Herosection";
import Navbar from "../components/Navbar";
import Pricing from "../components/Pricing";
import FlowSection from "../components/FlowSection";
import TrustedBrandsMarquee from "../components/TrustedBrandsMarquee";
import OurImpact from '../components/Ourimpact';
import Intigration from "../components/Intigration";
import ProfitAnalyticsSection from "../components/ProfitAnalyticsSection";
const Homepage = () => {
    return (
        // <div className="bg-[linear-gradient(135deg,#33C375,#002726)]">
        // <div   style={{ background: 'linear-gradient(to bottom, #0f0f0f, #000000 90%)' }}>
        <div className="bg-[#101218]">

        <Navbar />
        <Herosection/>
        <TrustedBrandsMarquee/>
        <FlowSection/> 
        <OurImpact/>
        <Intigration/>
        <ProfitAnalyticsSection/>
        <Blogsection/> 
        <Pricing/> 
        <FAQ/>
        <Footer/>
        </div>
      
    )
}

export default Homepage;