import os from "os";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function cpuTimes(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const t of Object.values(cpu.times)) total += t;
    idle += cpu.times.idle;
  }
  return { idle, total };
}

export async function GET() {
  const a = cpuTimes();
  await new Promise((r) => setTimeout(r, 200));
  const b = cpuTimes();
  const dTotal = b.total - a.total;
  const cpu = dTotal > 0 ? 100 * (1 - (b.idle - a.idle) / dTotal) : 0;
  return NextResponse.json({
    cpu: Math.round(Math.max(0, Math.min(100, cpu))),
    ramUsed: os.totalmem() - os.freemem(),
    ramTotal: os.totalmem(),
    osUptime: Math.round(os.uptime()),
    procUptime: Math.round(process.uptime()),
  });
}
