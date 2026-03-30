"use client";

import { Card } from "@safetywallet/ui";
import { AlertTriangle, Clock, CheckCircle } from "lucide-react";

interface ActionStatsCardsProps {
  overdueCount: number;
  inProgressCount: number;
  completedCount: number;
}

export function ActionStatsCards({
  overdueCount,
  inProgressCount,
  completedCount,
}: ActionStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="p-4 flex items-center gap-3">
        <div className="rounded-full bg-red-100 p-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">기한 초과</p>
          <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
        </div>
      </Card>
      <Card className="p-4 flex items-center gap-3">
        <div className="rounded-full bg-blue-100 p-2">
          <Clock className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">진행 중</p>
          <p className="text-2xl font-bold">{inProgressCount}</p>
        </div>
      </Card>
      <Card className="p-4 flex items-center gap-3">
        <div className="rounded-full bg-green-100 p-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">완료</p>
          <p className="text-2xl font-bold text-green-600">{completedCount}</p>
        </div>
      </Card>
    </div>
  );
}
