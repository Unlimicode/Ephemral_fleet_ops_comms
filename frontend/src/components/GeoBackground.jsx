import '../styles/animations.css';

export default function GeoBackground({ dark = false, density = 'normal', fixed = true }) {
    const pos = fixed ? 'fixed' : 'absolute';
    const gridClass = dark ? 'arch-grid-light' : 'arch-grid';
    const darkColor = dark ? 'rgba(245,237,227,0.12)' : 'rgba(13,13,13,0.12)';
    const accentColor = dark ? 'rgba(108,99,255,0.15)' : 'rgba(108,99,255,0.12)';
    const lightColor = dark ? 'rgba(245,237,227,0.06)' : 'rgba(13,13,13,0.06)';

    return (
        <>
            {/* Grid */}
            <div className={gridClass} style={{
                position: pos, inset: 0, zIndex: 0, pointerEvents: 'none'
            }} />

            {/* Shape 1 — large triangle top right, floating */}
            <div className="geo-shape animate-float" style={{
                position: pos, top: '8%', right: '6%', color: darkColor, zIndex: 0
            }}>
                <div className="geo-triangle" style={{ transform: 'scale(2.5) rotate(15deg)' }} />
            </div>

            {/* Shape 2 — medium triangle bottom left, slow float reverse */}
            <div className="geo-shape animate-float-reverse" style={{
                position: pos, bottom: '12%', left: '4%', color: accentColor, zIndex: 0
            }}>
                <div className="geo-triangle" style={{ transform: 'scale(2) rotate(-15deg)' }} />
            </div>

            {/* Shape 3 — spinning triangle mid right */}
            <div className="geo-shape animate-spin-slow" style={{
                position: pos, top: '38%', right: '14%', color: lightColor, zIndex: 0
            }}>
                <div className="geo-triangle" style={{ transform: 'scale(1.6) rotate(160deg)' }} />
            </div>

            {/* Shape 4 — morphing border circle top left — dense and normal only */}
            {density !== 'sparse' && (
                <div className="geo-shape animate-morph" style={{
                    position: pos, top: '20%', left: '8%',
                    width: '280px', height: '280px',
                    border: `50px solid ${darkColor}`,
                    borderRadius: '40% 60% 70% 30% / 40% 50% 60% 70%',
                    zIndex: 0
                }} />
            )}

            {/* Shape 5 — small triangle mid left, drift — dense only */}
            {density === 'dense' && (
                <div className="geo-shape animate-drift" style={{
                    position: pos, top: '55%', left: '18%', color: accentColor, zIndex: 0
                }}>
                    <div className="geo-triangle-sm" style={{ transform: 'rotate(30deg)' }} />
                </div>
            )}

            {/* Shape 6 — large spin reverse bottom right — dense only */}
            {density === 'dense' && (
                <div className="geo-shape animate-spin-reverse" style={{
                    position: pos, bottom: '5%', right: '20%', color: lightColor, zIndex: 0
                }}>
                    <div className="geo-triangle" style={{ transform: 'scale(1.8) rotate(45deg)' }} />
                </div>
            )}

            {/* Shape 7 — xs triangle floating fast top centre — normal and dense */}
            {density !== 'sparse' && (
                <div className="geo-shape animate-float-fast" style={{
                    position: pos, top: '15%', left: '42%', color: accentColor, zIndex: 0
                }}>
                    <div className="geo-triangle-xs" style={{ transform: 'rotate(-20deg)' }} />
                </div>
            )}
        </>
    );
}
