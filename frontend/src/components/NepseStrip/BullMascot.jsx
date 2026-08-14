import { DotLottiePlayer } from "@dotlottie/react-player";

function getBullAnimationPath(isOpen, pts) {
    if (!isOpen) return "/bull/meditating_bull.json";
    if (pts >= 0) return "/bull/Bull_running.json";
    return "/bull/angry_bull.json";
}

export default function BullMascot({ isOpen, pts, position }) {
    const animationPath = getBullAnimationPath(isOpen, pts);

    return (
        <div
            className="bull-lottie-container"
            aria-hidden="true"
            style={{
                position: "absolute",
                left: position
                    ? `clamp(calc(var(--mascot-size, 42px) / 2), ${position.x}%, calc(100% - (var(--mascot-size, 42px) / 2)))`
                    : isOpen ? "calc(var(--mascot-size, 42px) / 2)" : "calc(100% - (var(--mascot-size, 42px) / 2))",
                top: position ? `${position.y}%` : "50%",
                transform: "translate(-50%, -100%)",
                pointerEvents: "none",
                transition: "left 0.3s ease, top 0.3s ease"
            }}
        >
            <DotLottiePlayer
                key={animationPath}
                src={animationPath}
                loop
                autoplay
                className="bull-lottie-player"
            />
        </div>
    );
}