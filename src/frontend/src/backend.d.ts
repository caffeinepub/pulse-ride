import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    acceptRide(rideId: string, driverSessionId: string): Promise<boolean>;
    approveRide(rideId: string, riderSessionId: string): Promise<boolean>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    checkGhostChannel(code: string): Promise<string>;
    closeGhostChannel(code: string, sessionId: string): Promise<boolean>;
    createGhostChannel(code: string, sessionId: string): Promise<boolean>;
    createGroupChannel(groupCode: string, sessionId: string): Promise<boolean>;
    createRideRequest(riderSessionId: string, encryptedPickup: string, encryptedDropoff: string, phantomMode: boolean): Promise<[string, string]>;
    createSession(role: string): Promise<string>;
    endSession(sessionId: string): Promise<boolean>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getGhostMessages(code: string, sessionId: string, afterIndex: bigint): Promise<Array<[string, string, bigint]>>;
    getGroupMessages(groupCode: string, sessionId: string, afterTimestamp: bigint): Promise<Array<[string, string, bigint]>>;
    getMessages(rideId: string, requesterSessionId: string): Promise<Array<[string, string, bigint]>>;
    getReputation(sessionId: string): Promise<[string, bigint]>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    heartbeatQuery(): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    joinGhostChannel(code: string, sessionId: string): Promise<string>;
    joinGroupChannel(groupCode: string, sessionId: string): Promise<string>;
    leaveGroupChannel(groupCode: string, sessionId: string): Promise<boolean>;
    listAvailableRides(): Promise<Array<[string, string, boolean, string, bigint, bigint, bigint, string]>>;
    listGroupMembers(groupCode: string, sessionId: string): Promise<Array<string>>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    sendGhostMessage(code: string, senderSessionId: string, encryptedText: string): Promise<boolean>;
    sendGroupMessage(groupCode: string, sessionId: string, message: string): Promise<boolean>;
    sendMessage(rideId: string, senderSessionId: string, encryptedText: string): Promise<boolean>;
    submitRating(rideId: string, raterSessionId: string, stars: bigint): Promise<boolean>;
    updateRideStatus(rideId: string, sessionId: string, newStatus: string): Promise<boolean>;
}
