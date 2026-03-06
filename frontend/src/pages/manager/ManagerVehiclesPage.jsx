import ManagerLayout from '../../components/layout/ManagerLayout.jsx';
import GlassCard from '../../components/layout/GlassCard.jsx';
import PageWrapper from '../../components/layout/PageWrapper.jsx';

export default function ManagerVehiclesPage() {
    return (
        <ManagerLayout>
            <PageWrapper>
                <GlassCard className="p-8">
                    <h2 style={{ color: 'var(--text-primary)' }}>Vehicles</h2>
                </GlassCard>
            </PageWrapper>
        </ManagerLayout>
    );
}
