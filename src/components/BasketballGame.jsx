import React, { useState, useEffect, useRef } from 'react';
import nbaAllStarLogo from '../assets/nba-allstar.png';

const BasketballGame = () => {
  const [ballPos, setBallPos] = useState({ x: 100, y: 350 });
  const [isMoving, setIsMoving] = useState(false);
  const [time, setTime] = useState(0);
  const [score, setScore] = useState(0);
  const [power, setPower] = useState(0);
  const [holding, setHolding] = useState(false);
  const [currentVelocity, setCurrentVelocity] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [rotationSpeed, setRotationSpeed] = useState(0);
  const scoredRef = useRef(false);  // Using ref instead of state for immediate updates
  const [shotLabel, setShotLabel] = useState('');
  const hitBackboardRef = useRef(false);  // Changed from state to ref
  const [hitRim, setHitRim] = useState(false);
  const [makes, setMakes] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const attemptInProgressRef = useRef(false);  // Track if shot is in progress
  const containerRef = useRef(null);  // Add ref for container

  // Game constants
  const PERFECT_VELOCITY_X = 6.5;    // Reduced for more controlled horizontal movement
  const PERFECT_VELOCITY_Y = -13;    // Adjusted for optimal arc
  const GRAVITY = 0.45;              // Fine-tuned gravity
  const POWER_RATE = 0.8;           // Slower, constant power meter speed
  const POINTS_PER_BASKET = 3;
  const BOUNCE_DAMPING = 0.65;    // Reduced from 0.89 for less bouncy impacts
  const GROUND_FRICTION = 0.95;   // Adjusted for smoother rolling
  const MIN_SPEED = 0.2;
  const RESET_DELAY = 1500;
  const INITIAL_ROTATION_SPEED = 15;
  const BALL_RADIUS = 15;
  const RIM_WIDTH = 48;
  const RIM_Y = 180;
  const RIM_OFFSET = 50;  // Distance from right edge
  const ALLOWED_OFFSET = 15;
  const SWEET_SPOT_MIN = 45;  // Sweet spot range for power meter
  const SWEET_SPOT_MAX = 55;

  // Update game constants
  const POWER_MIN_FACTOR = 0.7;  // Minimum power factor (70% of perfect velocity)
  const POWER_MAX_FACTOR = 1.3;  // Maximum power factor (130% of perfect velocity)
  
  // Adjust sweet spot velocity modifiers
  const SWEET_SPOT_VELOCITY_MODIFIER = {
    x: 1.0,    // Perfect horizontal velocity in sweet spot
    y: 1.0,    // Perfect vertical velocity in sweet spot
    margin: 0.15  // Maximum deviation within sweet spot (15%)
  };

  // Helper to get power factor with better scaling
  const getPowerFactor = (powerValue) => {
    return POWER_MIN_FACTOR + (POWER_MAX_FACTOR - POWER_MIN_FACTOR) * (powerValue / 100);
  };

  // Calculate perfect velocities based on viewport
  const calculatePerfectVelocities = (containerWidth) => {
    // Target position (rim)
    const targetX = containerWidth - RIM_OFFSET - (RIM_WIDTH / 2);
    const targetY = RIM_Y;
    
    // Starting position
    const startX = 100;  // Initial ball X position
    const startY = 350;  // Initial ball Y position
    
    // Calculate distance to target
    const dx = targetX - startX;
    const dy = targetY - startY;
    
    // Time to reach target (experimentally determined for smooth arc)
    const timeToTarget = Math.sqrt(dx / 400) * 45;
    
    // Calculate required velocities using projectile motion equations
    const velocityX = dx / timeToTarget;
    const velocityY = (dy - (0.5 * GRAVITY * timeToTarget * timeToTarget)) / timeToTarget;
    
    return { velocityX, velocityY };
  };

  // Update shot physics calculation
  const calculateShotVelocity = (powerValue, containerWidth) => {
    const { velocityX, velocityY } = calculatePerfectVelocities(containerWidth);
    
    const sweetSpotCenter = (SWEET_SPOT_MIN + SWEET_SPOT_MAX) / 2;
    const distanceFromPerfect = Math.abs(powerValue - sweetSpotCenter);
    
    let velocityModifier;
    if (powerValue >= SWEET_SPOT_MIN && powerValue <= SWEET_SPOT_MAX) {
      // In sweet spot - very high chance of making it
      const sweetSpotProgress = distanceFromPerfect / (SWEET_SPOT_MAX - sweetSpotCenter);
      const randomVariation = (Math.random() * 2 - 1) * 0.02; // Even smaller variation for more consistent makes
      velocityModifier = 1 + (randomVariation * sweetSpotProgress);
    } else {
      // Outside sweet spot - still possible to make it but gets harder the further out you go
      const powerDiff = powerValue - sweetSpotCenter;
      const missScale = Math.abs(powerDiff) / 50; // How far from sweet spot
      
      if (powerValue < SWEET_SPOT_MIN) {
        // Short shots - slightly reduced velocities with some randomness
        const shortRandomness = Math.random() * 0.1; // Add some randomness
        return {
          x: velocityX * (0.95 - missScale * 0.05 + shortRandomness),
          y: velocityY * (0.95 - missScale * 0.05 + shortRandomness)
        };
      } else {
        // Long shots - slightly increased velocities with some randomness
        const longRandomness = Math.random() * 0.1; // Add some randomness
        return {
          x: velocityX * (1.05 + missScale * 0.05 + longRandomness),
          y: velocityY * (1.05 + missScale * 0.05 + longRandomness)
        };
      }
    }

    // Sweet spot shots
    return {
      x: velocityX * velocityModifier,
      y: velocityY * velocityModifier
    };
  };

  // Update viewport scaling helper
  const getViewportAdjustedVelocity = (baseVelocity, containerWidth) => {
    const standardWidth = 650;
    const scaleFactor = Math.sqrt(containerWidth / standardWidth);
    return baseVelocity * scaleFactor;
  };

  // Handle touch/click events
  const handleTouchStart = (e) => {
    e.preventDefault();
    if (!isMoving && !holding) {
      setHolding(true);
      setPower(0);  // Reset power when starting to hold
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    if (holding && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const velocity = calculateShotVelocity(power, containerWidth);
      
      setCurrentVelocity(velocity);
      setRotationSpeed(INITIAL_ROTATION_SPEED);
      setHolding(false);
      setIsMoving(true);
      setTime(0);
      attemptInProgressRef.current = true;
      hitBackboardRef.current = false;
      setHitRim(false);
    }
  };

  // Combined keyboard and touch controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isMoving && !holding) {
          setHolding(true);
          setPower(0);  // Reset power when starting to hold
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && holding && containerRef.current) {
        e.preventDefault();
        const containerWidth = containerRef.current.clientWidth;
        const velocity = calculateShotVelocity(power, containerWidth);
        
        setCurrentVelocity(velocity);
        setRotationSpeed(INITIAL_ROTATION_SPEED);
        setHolding(false);
        setIsMoving(true);
        setTime(0);
        attemptInProgressRef.current = true;
        hitBackboardRef.current = false;
        setHitRim(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isMoving, holding, power]);

  // Add state for tracking oscillation time
  const [oscillationTime, setOscillationTime] = useState(0);

  // Update power meter oscillation to maintain constant speed
  useEffect(() => {
    let powerInterval;
    let lastTime = null;
    const targetFrameRate = 60; // 60fps
    const msPerFrame = 1000 / targetFrameRate;
    
    const updatePower = (timestamp) => {
      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      
      if (deltaTime >= msPerFrame) {
        setPower(prev => {
          const newPower = prev + POWER_RATE;
          // Ensure we wrap exactly at 100
          return newPower >= 100 ? 0 : newPower;
        });
        lastTime = timestamp;
      }
      
      if (holding && !isMoving) {
        powerInterval = requestAnimationFrame(updatePower);
      }
    };

    if (holding && !isMoving) {
      powerInterval = requestAnimationFrame(updatePower);
    } else if (!holding) {
      setPower(0);
    }

    return () => {
      if (powerInterval) {
        cancelAnimationFrame(powerInterval);
      }
    };
  }, [holding, isMoving]);

  // Add shot timer
  useEffect(() => {
    let resetTimer;
    if (isMoving) {
      resetTimer = setTimeout(() => {
        setBallPos({ x: 100, y: 350 });
        setIsMoving(false);
        setTime(0);
        setCurrentVelocity({ x: 0, y: 0 });
        if (attemptInProgressRef.current) {
          // Update makes and attempts together at end of shot
          if (scoredRef.current) {
            setMakes(m => m + 1);
          } else {
            // Show MISS! if the shot didn't score
            setShotLabel('MISS!');
            setTimeout(() => {
              setShotLabel('');
            }, 1000);
          }
          setAttempts(a => a + 1);
          attemptInProgressRef.current = false;
          scoredRef.current = false;
          hitBackboardRef.current = false;
        }
      }, RESET_DELAY);
    }
    return () => clearTimeout(resetTimer);
  }, [isMoving]);

  // Ball physics with collisions
  useEffect(() => {
    let frameId;
    
    const updatePosition = () => {
      if (isMoving && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        setTime(t => t + 1);
        setRotation(r => r + rotationSpeed);
        setBallPos(pos => {
          const newPos = {
            x: pos.x + currentVelocity.x,
            y: pos.y + currentVelocity.y + (GRAVITY * time)
          };

          // Calculate rim positions based on container width
          const RIM_BACK = containerWidth - RIM_OFFSET;
          const RIM_FRONT = RIM_BACK - RIM_WIDTH;
          const SCORING_MARGIN = 10; // Add some margin for scoring detection

          // Ground collision with bounce
          if (newPos.y > 350) {
            newPos.y = 350;
            const speed = Math.sqrt(currentVelocity.x * currentVelocity.x + currentVelocity.y * currentVelocity.y);
            
            if (speed < MIN_SPEED) {
              setCurrentVelocity({ x: 0, y: 0 });
            } else {
              setCurrentVelocity(v => ({
                x: v.x * GROUND_FRICTION,
                y: -v.y * BOUNCE_DAMPING
              }));
              setRotationSpeed(rs => rs * GROUND_FRICTION);
            }
          }

          // Wall collisions with more realistic bounces
          if (newPos.x > containerWidth - 30) {
            newPos.x = containerWidth - 30;
            const impactForce = Math.abs(currentVelocity.x);
            setCurrentVelocity(v => ({
              x: -impactForce * 0.5,  // Reduced bounce force
              y: v.y * 0.9            // Reduce vertical velocity on impact
            }));
            setRotationSpeed(rs => -rs * 0.8);  // Reduced rotation on wall hits
            
            // Count as backboard hit if near rim height
            if (newPos.y > RIM_Y - 90 && newPos.y < RIM_Y + 90) {
              hitBackboardRef.current = true;
            }
          } else if (newPos.x < 30) {
            newPos.x = 30;
            const impactForce = Math.abs(currentVelocity.x);
            setCurrentVelocity(v => ({
              x: impactForce * 0.5,   // Reduced bounce force
              y: v.y * 0.9            // Reduce vertical velocity on impact
            }));
            setRotationSpeed(rs => -rs * 0.8);  // Reduced rotation on wall hits
          }

          // Rim collisions with improved physics and better detection
          if (newPos.y > RIM_Y - 20 && newPos.y < RIM_Y + 20) {
            // Ball hitting front of rim
            if (newPos.x + BALL_RADIUS > RIM_FRONT && newPos.x - BALL_RADIUS < RIM_FRONT && pos.x - BALL_RADIUS <= RIM_FRONT) {
              newPos.x = RIM_FRONT - BALL_RADIUS;
              setCurrentVelocity(v => ({
                x: -v.x * BOUNCE_DAMPING * 0.8,
                y: v.y * 0.95 - 1.5
              }));
              setHitRim(true);
            }
            // Ball hitting back of rim
            else if (newPos.x + BALL_RADIUS > RIM_BACK && newPos.x - BALL_RADIUS < RIM_BACK && pos.x + BALL_RADIUS >= RIM_BACK) {
              newPos.x = RIM_BACK + BALL_RADIUS;
              setCurrentVelocity(v => ({
                x: -v.x * BOUNCE_DAMPING * 0.8,
                y: v.y * 0.95 - 1.5
              }));
              setHitRim(true);
            }
          }

          // Score detection at the actual scoring position
          const isPassingDownThroughRim = pos.y <= RIM_Y && newPos.y >= RIM_Y;
          const isWithinRimXRange = newPos.x >= RIM_FRONT && newPos.x <= RIM_BACK + RIM_WIDTH;

          if (!scoredRef.current && isPassingDownThroughRim && isWithinRimXRange) {
            setScore(s => s + POINTS_PER_BASKET);
            scoredRef.current = true;
            
            // Set shot label based on how it went in
            if (!hitBackboardRef.current && !hitRim) {
              setShotLabel('SWISH!');
            } else if (hitBackboardRef.current && !hitRim) {
              setShotLabel('OFF THE GLASS!');
            } else {
              setShotLabel('SCORE!');
            }
            
            setTimeout(() => {
              setShotLabel('');
            }, 1000);
          }

          // Debug logging
          if (Math.abs(newPos.y - RIM_Y) < 50) {
            console.log('Ball Position:', {
              yDistanceFromRim: (RIM_Y - newPos.y).toFixed(1),
              xPosition: newPos.x,
              rimFront: RIM_FRONT,
              rimBack: RIM_BACK,
              ballVelocityY: currentVelocity.y,
              isPassingThrough: isPassingDownThroughRim,
              isWithinRange: isWithinRimXRange,
              willScore: !scoredRef.current && isPassingDownThroughRim && isWithinRimXRange
            });
          }

          return newPos;
        });
        
        frameId = requestAnimationFrame(updatePosition);
      }
    };

    if (isMoving) {
      frameId = requestAnimationFrame(updatePosition);
    }

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isMoving, time, currentVelocity, rotationSpeed]);

  // Update the power meter color calculation to center on sweet spot
  const getPowerMeterColor = (powerValue) => {
    const sweetSpotCenter = (SWEET_SPOT_MIN + SWEET_SPOT_MAX) / 2;
    const sweetSpotRange = (SWEET_SPOT_MAX - SWEET_SPOT_MIN) / 2;
    
    // Calculate distance from sweet spot center
    const distanceFromCenter = Math.abs(powerValue - sweetSpotCenter);
    
    if (distanceFromCenter <= sweetSpotRange) {
      return '#22c55e'; // green-500 for sweet spot
    } else if (powerValue < sweetSpotCenter) {
      return '#fbbf24'; // yellow-400 for too weak
    } else {
      return '#ef4444'; // red-500 for too strong
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center select-none">
      {/* NBA All-Star Logo */}
      <img 
        src={nbaAllStarLogo}
        alt="NBA All-Star 2025 San Francisco Bay Area" 
        className="w-full max-w-[400px] mb-6 px-4"
      />
      
      {/* Game Container */}
      <div 
        ref={containerRef}
        className="relative w-full max-w-[650px] h-[400px] sm:h-[400px] bg-gray-900 border-2 border-gray-700 touch-none select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        {/* Score and Accuracy */}
        <div className="absolute top-0 left-0 right-0 p-2 sm:p-4 flex justify-between items-start text-white select-none">
          <div className="flex flex-col select-none">
            <div className="text-xl sm:text-2xl font-bold">{score}</div>
            <div className="text-lg sm:text-xl">
              {makes} / {attempts} ({attempts > 0 ? Math.round((makes/attempts) * 100) : 0}%)
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 sm:gap-2 select-none">
            <div className="text-xs sm:text-sm text-center">
              {window.innerWidth <= 640 ? 'Tap and hold to shoot!' : 'Hold SPACEBAR to set power - More power = longer shot!'}
            </div>
            <div className="relative w-24 sm:w-32 h-4 sm:h-6 border-2 border-white bg-black">
              {/* Sweet spot range indicators */}
              <div 
                className="absolute h-full w-0.5 bg-white opacity-30" 
                style={{ left: `${SWEET_SPOT_MIN}%` }}
              />
              <div 
                className="absolute h-full w-0.5 bg-white opacity-50" 
                style={{ left: `${(SWEET_SPOT_MIN + SWEET_SPOT_MAX) / 2}%` }}
              />
              <div 
                className="absolute h-full w-0.5 bg-white opacity-30" 
                style={{ left: `${SWEET_SPOT_MAX}%` }}
              />
              {/* Power meter fill */}
              <div
                className="h-full transition-all duration-75"
                style={{ 
                  width: `${power}%`,
                  backgroundColor: getPowerMeterColor(power)
                }}
              />
            </div>
          </div>
        </div>

        {/* Shot Label */}
        {shotLabel && (
          <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-3xl sm:text-4xl font-bold text-white z-10 select-none">
            {shotLabel}
          </div>
        )}

        {/* Ball */}
        <div
          className="absolute text-3xl sm:text-4xl transition-transform select-none"
          style={{
            left: `${ballPos.x}px`,
            top: `${ballPos.y}px`,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`
          }}
        >
          🏀
        </div>

        {/* 3pt Line Indicator */}
        <div className="absolute text-white font-bold select-none" style={{ left: '150px', bottom: '10px' }}>
          |
          <br />
          3pts
        </div>

        {/* Floor */}
        <div className="absolute bottom-0 w-full h-1 bg-gray-700" />

        {/* Hoop */}
        <div className="absolute select-none" style={{ right: '50px', top: '180px' }}>
          <div className="relative">
            {/* Backboard */}
            <div className="absolute h-24 w-1 bg-white" 
                 style={{ left: '48px', top: '-90px' }} />
            
            {/* Rim */}
            <div className="absolute w-12 h-1 bg-red-500" />
            
            {/* Post */}
            <div className="absolute w-1 h-40 bg-yellow-500 left-12" />
            
            {/* Wastebasket */}
            <div className="absolute text-4xl transform scale-150" 
                 style={{ left: '0px', top: '0px' }}>
              🗑️
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BasketballGame;