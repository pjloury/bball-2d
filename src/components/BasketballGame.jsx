import React, { useState, useEffect } from 'react';

const BasketballGame = () => {
  const [ballPos, setBallPos] = useState({ x: 100, y: 350 });
  const [isMoving, setIsMoving] = useState(false);
  const [time, setTime] = useState(0);
  const [score, setScore] = useState(0);
  const [scored, setScored] = useState(false);
  const [power, setPower] = useState(0);
  const [holding, setHolding] = useState(false);
  const [currentVelocity, setCurrentVelocity] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [rotationSpeed, setRotationSpeed] = useState(0);

  // Game constants
  const PERFECT_VELOCITY_X = 12;
  const PERFECT_VELOCITY_Y = -18;
  const GRAVITY = 0.4;
  const POWER_RATE = 2.0;
  const POINTS_PER_BASKET = 3;
  const BOUNCE_DAMPING = 0.85;
  const GROUND_FRICTION = 0.99;    // Increased from 0.98 for even less friction
  const MIN_SPEED = 0.1;
  const RESET_DELAY = 2000;
  const INITIAL_ROTATION_SPEED = 15;

  // Handle spacebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (isMoving) {
          setBallPos({ x: 100, y: 350 });
          setIsMoving(false);
          setTime(0);
          setCurrentVelocity({ x: 0, y: 0 });
          setScored(false);
          setRotation(0);
          setRotationSpeed(0);
        }
        setHolding(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && holding) {
        e.preventDefault();
        const powerFactor = power / 100;  // Now using full power range from 0-100%
        setCurrentVelocity({
          x: PERFECT_VELOCITY_X * powerFactor,
          y: PERFECT_VELOCITY_Y * powerFactor
        });
        setHolding(false);
        setIsMoving(true);
        setTime(0);
        setScored(false);
        setRotationSpeed(INITIAL_ROTATION_SPEED);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isMoving, holding, power]);

  // Power meter
  useEffect(() => {
    let powerInterval;
    if (holding && !isMoving) {
      powerInterval = setInterval(() => {
        setPower(prev => {
          if (prev >= 100) return 0;
          return prev + POWER_RATE;
        });
      }, 20);
    } else if (!holding) {
      setPower(0);
    }
    return () => clearInterval(powerInterval);
  }, [holding, isMoving]);

  // Ball physics with collisions
  useEffect(() => {
    let frameId;
    
    const updatePosition = () => {
      if (isMoving) {
        setTime(t => t + 1);
        setRotation(r => r + rotationSpeed);  // Update rotation each frame
        setBallPos(pos => {
          const newPos = {
            x: pos.x + currentVelocity.x,
            y: pos.y + currentVelocity.y + (GRAVITY * time)
          };

          // Ground collision with friction - preserve more horizontal momentum
          if (newPos.y > 350) {
            newPos.y = 350;
            setCurrentVelocity(v => ({
              x: v.x * GROUND_FRICTION * 1.1,  // Boost horizontal momentum
              y: -v.y * BOUNCE_DAMPING * 0.9
            }));
            setRotationSpeed(rs => rs * GROUND_FRICTION);
            setTime(0);
          }

          // Wall collision - stronger horizontal bounce
          if (newPos.x > 620) {
            newPos.x = 620;
            setCurrentVelocity(v => ({
              x: -v.x * BOUNCE_DAMPING * 1.2,
              y: v.y * 0.98
            }));
            setRotationSpeed(rs => -rs * BOUNCE_DAMPING);
          }

          // Backboard collision with improved physics
          if (newPos.x > 630 && pos.y > 160 && pos.y < 240) {
            newPos.x = 628;
            const impactForce = Math.abs(currentVelocity.x);
            if (impactForce > 8) {
              setCurrentVelocity(v => ({
                x: -v.x * BOUNCE_DAMPING * 1.3,  // Increased bounce for hard hits
                y: v.y * 0.95 - 2
              }));
            } else {
              setCurrentVelocity(v => ({
                x: -v.x * BOUNCE_DAMPING * 1.1,  // Increased bounce for soft hits
                y: v.y * 0.95
              }));
            }
          }

          // Super simplified scoring detection - just check if ball passes through rim plane
          const RIM_FRONT = 580;
          const RIM_BACK = 628;
          const RIM_Y = 190;

          // Score if ball passes through rim area and hasn't scored on this shot yet
          if (!scored && 
              pos.x <= RIM_BACK && newPos.x >= RIM_FRONT && 
              Math.abs(newPos.y - RIM_Y) < 25) {  // Generous vertical range
            setScore(s => s + POINTS_PER_BASKET);
            setScored(true);
          }

          // Rim collisions with improved physics
          if (newPos.y > RIM_Y - 20 && newPos.y < RIM_Y + 20) {
            const BALL_RADIUS = 15;
            // Ball hitting front of rim
            if (newPos.x + BALL_RADIUS > RIM_FRONT && newPos.x - BALL_RADIUS < RIM_FRONT && pos.x - BALL_RADIUS <= RIM_FRONT) {
              newPos.x = RIM_FRONT - BALL_RADIUS;
              setCurrentVelocity(v => ({
                x: -v.x * BOUNCE_DAMPING * 1.2,  // Increased from 0.9 to 1.2
                y: v.y * 0.95 - 1.5
              }));
            }
            // Ball hitting back of rim
            else if (newPos.x + BALL_RADIUS > RIM_BACK && newPos.x - BALL_RADIUS < RIM_BACK && pos.x + BALL_RADIUS >= RIM_BACK) {
              newPos.x = RIM_BACK + BALL_RADIUS;
              setCurrentVelocity(v => ({
                x: -v.x * BOUNCE_DAMPING * 1.2,  // Increased from 0.9 to 1.2
                y: v.y * 0.95 - 1.5
              }));
            }
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
  }, [isMoving, time, currentVelocity, scored, rotationSpeed]);

  // Add shot timer
  useEffect(() => {
    let resetTimer;
    if (isMoving) {
      resetTimer = setTimeout(() => {
        setBallPos({ x: 100, y: 350 });
        setIsMoving(false);
        setTime(0);
        setCurrentVelocity({ x: 0, y: 0 });
        setScored(false);
      }, RESET_DELAY);
    }
    return () => clearTimeout(resetTimer);
  }, [isMoving]);

  return (
    <div className="min-h-screen bg-white flex justify-center items-center">
      <div className="relative w-[650px] h-[400px] bg-gray-900 border-2 border-gray-700">
        {/* Score and Instructions */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center text-white">
          <div className="text-2xl font-bold">Score: {score}</div>
          <div className="text-sm">
            Hold SPACEBAR to set power - More power = longer shot!
          </div>
          <div className="w-32 h-6 border-2 border-white bg-black">
            <div
              className="h-full transition-all duration-75"
              style={{ 
                width: `${power}%`,
                backgroundColor: '#22c55e'  // Always green now since all power levels are valid
              }}
            />
          </div>
        </div>

        {/* Ball */}
        <div
          className="absolute text-4xl transition-transform"
          style={{
            left: `${ballPos.x}px`,
            top: `${ballPos.y}px`,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`
          }}
        >
          🏀
        </div>

        {/* 3pt Line Indicator */}
        <div className="absolute text-white font-bold" style={{ left: '150px', bottom: '10px' }}>
          |
          <br />
          3pts
        </div>

        {/* Floor */}
        <div className="absolute bottom-0 w-full h-1 bg-gray-700" />

        {/* Hoop */}
        <div className="absolute" style={{ right: '50px', top: '180px' }}>
          <div className="relative">
            {/* Backboard */}
            <div className="absolute h-24 w-1 bg-white" 
                 style={{ left: '48px', top: '-60px' }} />
            
            {/* Rim */}
            <div className="absolute w-12 h-1 bg-red-500" />
            
            {/* Post */}
            <div className="absolute w-0.5 h-40 bg-white left-8" />
            
            {/* Wastebasket */}
            <div className="absolute text-4xl transform scale-150" 
                 style={{ left: '0px', top: '-8px' }}>
              🗑️
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BasketballGame;