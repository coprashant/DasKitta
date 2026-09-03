import { DotLottiePlayer } from "@dotlottie/react-player";

function getBullAnimationPath(isOpen, pts) {
    if (!isOpen) return "/bull/meditating_bull.json";
    if (pts >= 0) return "/bull/Bull_running.json";
    return "/bull/angry_bull.json";
}

function getMascotScale(animationPath) {
    if (animationPath.includes("Bull_running")) return 3.36;
    if (animationPath.includes("meditating_bull")) return 1.05;
    return 1;
}

function getRunningBullPlacement(position, mascotHalfSize) {
    const runningMinLeft = "calc(var(--mascot-size, 42px) * 0.55)";
    const runningLeftNudge = "calc(var(--mascot-size, 42px) * 0.35)";

    return {
        left: position
            ? `clamp(${runningMinLeft}, calc(${position.x}% - ${runningLeftNudge}), calc(100% - ${mascotHalfSize}))`
            : runningMinLeft,
        top: position ? `${position.y}%` : "50%"
    };
}

function getDefaultBullPlacement(isOpen, position, mascotHalfSize) {
    if (!isOpen) {
        return {
            left: `calc(100% - ${mascotHalfSize})`,
            top: position ? `${position.y}%` : "50%"
        };
    }

    return {
        left: position
            ? `clamp(${mascotHalfSize}, ${position.x}%, calc(100% - ${mascotHalfSize}))`
            : mascotHalfSize,
        top: position ? `${position.y}%` : "50%"
    };
}

export default function BullMascot({ isOpen, pts, position }) {
    const animationPath = getBullAnimationPath(isOpen, pts);
    const isRunningBull = animationPath.includes("Bull_running");
    const mascotScale = getMascotScale(animationPath);
    const mascotSize = `calc(var(--mascot-size, 42px) * ${mascotScale})`;
    const mascotHalfSize = `calc((${mascotSize}) / 2)`;
    const placement = isRunningBull
        ? getRunningBullPlacement(position, mascotHalfSize)
        : getDefaultBullPlacement(isOpen, position, mascotHalfSize);

    return (
        <div
            className="bull-lottie-container"
            aria-hidden="true"
            style={{
                position: "absolute",
                left: placement.left,
                top: placement.top,
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
                style={{ width: mascotSize, height: mascotSize }}
            />
        </div>
    );
}