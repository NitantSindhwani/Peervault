/**
 * Continuous Hardware Detector & Capability Scaler Engine
 * 
 * Inspects CPU core count, GPU model string via WebGL, and safe RAM allocation budget
 * to scale Web Workers, WebRTC SCTP DataChannels, and in-memory buffer ceilings continuously.
 */

export interface HardwareCapabilities {
  cpuCores: number;
  gpuName: string;
  ramGB: number;
  ramBudgetMB: number;
  workerCount: number;
  dataChannelCount: number;
  inMemoryThresholdMB: number;
  hardwareTierName: string;
}

export function getHardwareCapabilities(): HardwareCapabilities {
  if (typeof window === 'undefined') {
    return {
      cpuCores: 4,
      gpuName: 'Standard GPU',
      ramGB: 8,
      ramBudgetMB: 1536,
      workerCount: 2,
      dataChannelCount: 2,
      inMemoryThresholdMB: 1536,
      hardwareTierName: 'Standard',
    };
  }

  // 1. CPU Core Inspection
  const cpuCores = Math.max(2, navigator.hardwareConcurrency || 4);

  // 2. Unmasked GPU Inspection via WebGL 2.0 / 1.0 Extension
  let gpuName = 'Integrated Graphics';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        if (renderer) {
          gpuName = String(renderer).replace(/ANGLE \((.*)\)/, '$1').trim();
        }
      }
    }
  } catch {}

  // Detect OS & Mobile platform
  const userAgent = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(userAgent);
  const isMobile = isIOS || isAndroid;

  // 3. RAM Budget Calculation with Cross-Platform Safeguards
  const reportedRAM = (navigator as any).deviceMemory || (isMobile ? 4 : 8);
  let ramGB = reportedRAM;

  // High-Throughput Safe RAM Allocation Budget Matrix
  let ramBudgetMB = 3584;
  if (isIOS) {
    // Safari WebKit memory limit protection: max 512MB to prevent tab eviction
    ramBudgetMB = 512;
  } else if (isAndroid) {
    ramBudgetMB = ramGB <= 4 ? 512 : Math.min(2560, ramGB * 384);
  } else if (ramGB <= 4) {
    ramBudgetMB = 1536; // 1.5 GB RAM budget (~37%)
  } else if (ramGB <= 8) {
    ramBudgetMB = 3584; // 3.5 GB RAM budget (~44%)
  } else if (ramGB <= 16) {
    ramBudgetMB = 8704; // 8.5 GB High-Speed RAM budget (~53%)
  } else if (ramGB <= 32) {
    ramBudgetMB = 18432; // 18.0 GB High-Speed RAM budget (~56%)
  } else if (ramGB <= 64) {
    ramBudgetMB = 38912; // 38.0 GB Ultra RAM budget (~60%)
  } else {
    ramBudgetMB = 81920; // 80.0 GB Ultra RAM budget for 128GB+ workstations (~62%)
  }

  // 4. Worker Count & SCTP Channel Scaling
  // Mobile protection: cap workers to 4 and channels to 4 for thermal/battery optimization
  let workerCount = Math.max(2, Math.min(24, cpuCores <= 4 ? 2 : cpuCores - 2));
  let dataChannelCount = Math.min(12, Math.max(2, Math.floor(cpuCores / 2)));

  if (isMobile) {
    workerCount = Math.min(4, workerCount);
    dataChannelCount = Math.min(4, dataChannelCount);
  }

  // Hardware Tier Categorization for Display
  let hardwareTierName = 'Standard';
  if (isMobile) {
    hardwareTierName = isIOS ? 'Mobile iOS' : 'Mobile Android';
  } else if (cpuCores >= 16 || ramGB >= 32) {
    hardwareTierName = 'Extreme Enthusiast';
  } else if (cpuCores >= 8 || ramGB >= 16) {
    hardwareTierName = 'High Performance';
  } else if (cpuCores >= 4) {
    hardwareTierName = 'Mid-Range';
  }

  return {
    cpuCores,
    gpuName,
    ramGB,
    ramBudgetMB,
    workerCount,
    dataChannelCount,
    inMemoryThresholdMB: ramBudgetMB,
    hardwareTierName,
  };
}
