import { useState, useEffect, useRef } from "react";

const createPath = (centerX, centerY, radius, innerRadius, startAngle, endAngle, isHovered = false) => {
  const start = (startAngle * Math.PI) / 180;
  const end = (endAngle * Math.PI) / 180;
  const actualRadius = isHovered ? radius + 5 : radius;
  const actualInnerRadius = isHovered ? innerRadius - 3 : innerRadius;

  const x1 = centerX + actualRadius * Math.cos(start);
  const y1 = centerY + actualRadius * Math.sin(start);
  const x2 = centerX + actualRadius * Math.cos(end);
  const y2 = centerY + actualRadius * Math.sin(end);
  const x3 = centerX + actualInnerRadius * Math.cos(end);
  const y3 = centerY + actualInnerRadius * Math.sin(end);
  const x4 = centerX + actualInnerRadius * Math.cos(start);
  const y4 = centerY + actualInnerRadius * Math.sin(start);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return `M ${x1} ${y1} A ${actualRadius} ${actualRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${actualInnerRadius} ${actualInnerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
};

const getLabelPosition = (centerX, centerY, angle, radius) => {
  const radian = (angle * Math.PI) / 180;
  const x = centerX + radius * Math.cos(radian);
  const y = centerY + radius * Math.sin(radian);
  return { x, y };
};

const getTextAnchor = (angle) => {
  // Normalize angle to 0-360
  const normalizedAngle = ((angle % 360) + 360) % 360;
  // Top and bottom should be centered
  if ((normalizedAngle > 70 && normalizedAngle < 110) || (normalizedAngle > 250 && normalizedAngle < 290)) {
    return 'middle';
  }
  // Left side should be end-aligned (text extends to the left)
  if (normalizedAngle > 110 && normalizedAngle < 250) {
    return 'end';
  }
  // Right side should be start-aligned (text extends to the right)
  return 'start';
};

const formatLargeNumber = (value) => {
  if (typeof value === 'string' && value.includes('₹')) {
    // Extract number from string like "₹5,67,890"
    const numStr = value.replace(/[₹,]/g, '');
    const num = parseFloat(numStr);
    if (isNaN(num)) return value;
    
    if (num >= 10000000) { // 1 crore
      return `₹${(num / 10000000).toFixed(2)}Cr`;
    } else if (num >= 100000) { // 1 lakh
      return `₹${(num / 100000).toFixed(2)}L`;
    }
    return value;
  }
  return value;
};

export const AnimatedPieChart = ({ data, centerLabel, centerValue, size = 400 }) => {
  const [animationProgress, setAnimationProgress] = useState(0);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [loadedSegments, setLoadedSegments] = useState(new Array(data.length).fill(false));
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  const padding = 60; // Add padding for labels
  const svgSize = size + (padding * 2);
  const centerX = svgSize / 2;
  const centerY = svgSize / 2;
  const radius = size * 0.22;
  const innerRadius = size * 0.16;
  const labelRadius = size * 0.34;

  // Calculate total value
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  // Intersection Observer to detect when chart is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setAnimationProgress(0);
          setLoadedSegments(new Array(data.length).fill(false));
        } else {
          setIsVisible(false);
        }
      },
      { threshold: 0.3 } // Trigger when 30% of the chart is visible
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [data.length]);

  // Animation effect - only runs when visible
  useEffect(() => {
    if (!isVisible) return;

    const duration = 2000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setAnimationProgress(progress);

      const newLoadedSegments = data.map((_, index) => {
        const segmentProgress = (index + 1) / data.length;
        return progress >= segmentProgress;
      });
      setLoadedSegments(newLoadedSegments);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, data.length]);

  let currentAngle = -90;

  return (
    <div ref={containerRef} className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={svgSize} height={svgSize} className="overflow-visible">
        {data.map((segment, index) => {
          const percentage = (segment.value / totalValue) * 100;
          const startAngle = currentAngle;
          const endAngle = currentAngle + (percentage * 360) / 100;
          const midAngle = (startAngle + endAngle) / 2;
          const isHovered = hoveredSegment === index;
          const path = createPath(centerX, centerY, radius, innerRadius, startAngle, endAngle, isHovered);
          const segmentProgress = (index + 1) / data.length;
          const segmentOpacity = animationProgress >= segmentProgress ? 1 : 0;
          const isLoaded = loadedSegments[index];

          // Adjust label radius for specific segments to prevent overlap
          let adjustedLabelRadius = labelRadius;
          // Push "Pickup Pending" and "NDR Pending" labels to different distances
          if (segment.name === 'Pickup Pending') {
            adjustedLabelRadius = labelRadius * 1.25;
          } else if (segment.name === 'NDR Pending') {
            adjustedLabelRadius = labelRadius * 1.05;
          }
          
          const labelPos = getLabelPosition(centerX, centerY, midAngle, adjustedLabelRadius);

          currentAngle = endAngle + 3;

          return (
            <g key={index}>
              <path
                d={path}
                fill={segment.color}
                className={`transition-all duration-300 cursor-pointer ${
                  isHovered ? 'brightness-125 drop-shadow-lg' : 'hover:brightness-110'
                } ${isLoaded ? 'animate-fade-in' : ''}`}
                style={{
                  opacity: segmentOpacity,
                  transformOrigin: `${centerX}px ${centerY}px`,
                  transform: isLoaded ? 'scale(1)' : 'scale(0.8)',
                  filter: isHovered ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' : 'none',
                }}
                onMouseEnter={() => setHoveredSegment(index)}
                onMouseLeave={() => setHoveredSegment(null)}
              />
              
              {/* Label - Name */}
              <text
                x={labelPos.x}
                y={labelPos.y - 8}
                textAnchor={getTextAnchor(midAngle)}
                className={`fill-gray-300 text-xs font-medium transition-all duration-300 ${
                  isHovered ? 'fill-white text-sm font-bold' : ''
                } ${isLoaded ? 'animate-fade-up' : ''}`}
                style={{ 
                  opacity: segmentOpacity,
                  transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {segment.name}
              </text>
              
              {/* Label - Amount */}
              <text
                x={labelPos.x}
                y={labelPos.y + 8}
                textAnchor={getTextAnchor(midAngle)}
                className={`fill-gray-400 text-[10px] transition-all duration-300 ${
                  isHovered ? 'fill-gray-200 text-xs font-medium' : ''
                } ${isLoaded ? 'animate-fade-up' : ''}`}
                style={{ 
                  opacity: segmentOpacity,
                  transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                  animationDelay: '0.1s',
                }}
              >
                {typeof segment.value === 'number' ? segment.value.toLocaleString("en-IN") : segment.value}
              </text>

              {/* Hover Tooltip - Percentage */}
              {isHovered && (() => {
                // Position tooltip away from labels
                const tooltipRadius = radius - 20;
                const tooltipPos = getLabelPosition(centerX, centerY, midAngle, tooltipRadius);
                const tooltipX = tooltipPos.x;
                const tooltipY = tooltipPos.y;

                return (
                  <g className="pointer-events-none">
                    <rect
                      x={tooltipX - 40}
                      y={tooltipY - 12}
                      width={80}
                      height={24}
                      rx={6}
                      fill="rgba(0,0,0,0.95)"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth={1}
                      className="animate-fade-in pointer-events-none"
                    />
                    <text
                      x={tooltipX}
                      y={tooltipY + 3}
                      textAnchor="middle"
                      className="fill-white text-[10px] font-semibold pointer-events-none"
                    >
                      {percentage.toFixed(1)}% of total
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}
      </svg>

      {/* Center Label - Only show after animation completes */}
      {animationProgress >= 1 && (() => {
        // Format large numbers to Lakhs/Crores if needed
        const formattedValue = formatLargeNumber(centerValue);
        
        // Adjust font size based on value length to keep it inside circle
        const valueLength = formattedValue.length;
        let fontSize = 'text-xl';
        if (valueLength > 15) fontSize = 'text-sm';
        else if (valueLength > 12) fontSize = 'text-base';
        else if (valueLength > 10) fontSize = 'text-lg';

        return (
          <div 
            className="absolute flex flex-col items-center justify-center pointer-events-none animate-fade-in px-2"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              maxWidth: `${innerRadius * 2 * 0.9}px`
            }}
          >
            <span className="text-gray-400 text-xs">{centerLabel}</span>
            <span className={`text-white font-bold ${fontSize} whitespace-nowrap overflow-hidden text-ellipsis`}>
              {formattedValue}
            </span>
          </div>
        );
      })()}

      {/* Legend Below Chart */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center justify-center gap-6 px-4 pb-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-2.5">
            <div 
              className="w-4 h-4 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-300 text-sm font-medium">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnimatedPieChart;
