import { useActor } from "@/hooks/useActor";
import { useQuery } from "@tanstack/react-query";

export function useReputation(sessionId: string) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["reputation", sessionId],
    queryFn: async () => {
      if (!actor) return null;
      const [label, rides] = await actor.getReputation(sessionId);
      return { label, rides: Number(rides) };
    },
    enabled: !!actor && !isFetching && !!sessionId,
  });
}

export function useAvailableRides() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["available-rides"],
    queryFn: async () => {
      if (!actor) return [];
      const rides = await actor.listAvailableRides();
      return rides.map(([rideId, sessionCode, isPhantom, riderTrust]) => ({
        rideId,
        sessionCode,
        isPhantom,
        riderTrust,
      }));
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5000,
  });
}
