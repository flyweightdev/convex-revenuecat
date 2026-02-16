import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { RefreshCw, Shield, Inbox, Loader2 } from "lucide-react";

export function ProfilePage() {
  const entitlements = useQuery(api.revenuecat.getAllEntitlements);
  const subscriber = useQuery(api.revenuecat.getMySubscriber);
  const syncEntitlements = useAction(api.revenuecat.syncEntitlements);

  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncEntitlements();
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="pt-4 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Your Entitlements</h1>
          <p className="mt-1 text-muted-foreground">
            View your RevenueCat entitlements synced to Convex
          </p>
        </div>
        <Button
          variant="outline"
          className="border-border/80"
          onClick={() => void handleSync()}
          disabled={syncing}
        >
          {syncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync Now
        </Button>
      </div>

      {/* Subscriber info */}
      {subscriber !== undefined && subscriber !== null && (
        <section className="mb-8">
          <div className="rounded-xl border border-border/50 bg-card/50 p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  App User ID
                </p>
                <p className="font-mono text-sm text-foreground/80 truncate">
                  {subscriber.appUserId}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Last Synced
                </p>
                <p className="text-sm text-foreground/80">
                  {new Date(subscriber.lastSyncedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Entitlements */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary border border-border">
            <Shield className="h-4 w-4 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Entitlements</h2>
        </div>

        {entitlements === undefined ? (
          <LoadingPlaceholder />
        ) : entitlements.length === 0 ? (
          <EmptyState icon={Inbox} message="No entitlements found. Make a purchase to get started." />
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground/80">Entitlement</TableHead>
                  <TableHead className="text-muted-foreground/80">Status</TableHead>
                  <TableHead className="text-muted-foreground/80">Expires</TableHead>
                  <TableHead className="text-muted-foreground/80">Last Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entitlements.map((ent: any) => (
                  <TableRow key={ent.entitlementId} className="border-border/30">
                    <TableCell>
                      <code className="font-mono text-xs text-foreground/80">
                        {ent.entitlementId}
                      </code>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ent.isActive ? "active" : "cancelled"} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ent.expiresDate
                        ? new Date(ent.expiresDate).toLocaleDateString()
                        : "Lifetime"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(ent.lastSyncedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

function LoadingPlaceholder() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-12 w-full rounded-xl bg-secondary/50" />
      <Skeleton className="h-12 w-full rounded-xl bg-secondary/50" />
      <Skeleton className="h-12 w-3/4 rounded-xl bg-secondary/50" />
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-12">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/50 border border-border">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
