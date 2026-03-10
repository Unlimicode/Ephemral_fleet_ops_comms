import GlassCard from '../../components/layout/GlassCard.jsx';
import PageWrapper from '../../components/layout/PageWrapper.jsx';
import GeoBackground from '../../components/GeoBackground';

export default function BookingLandingPage() {
    return (
        <PageWrapper>
            <GeoBackground density="sparse" fixed={true} />
            <GlassCard className="p-8" style={{ position: 'relative', zIndex: 10 }}>
                <h2 style={{ color: 'var(--text-dark)' }}>Book a Trip</h2>
            </GlassCard>
        </PageWrapper>
    );
}
