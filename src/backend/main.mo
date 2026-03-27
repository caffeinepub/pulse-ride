import List "mo:core/List";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import Iter "mo:core/Iter";
import Map "mo:core/Map";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";



actor {
  // --- Mixins and Prefabs (Don't touch!) ---
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // --- User Profile Management (Do not remove) ---
  public type UserProfile = {
    name : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  // All functions must be properly protected―see specification.
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // --- Core Types ---
  type Session = {
    role : Text;
    trustScore : Int;
    rideCount : Nat;
  };

  type RideRequest = {
    id : Text;
    riderSessionId : Text;
    encryptedPickup : Text;
    encryptedDropoff : Text;
    sessionCode : Text;
    expiresAt : Nat;
    status : Text;
    driverSessionId : ?Text;
    phantomMode : Bool;
    riderTrust : Text;
    aiPrice : Nat;
    distanceKm : Nat;
    durationMin : Nat;
    trafficLevel : Text;
  };

  type ChatMessage = {
    rideId : Text;
    senderRole : Text;
    encryptedText : Text;
    timestamp : Int;
  };

  type Rating = {
    rideId : Text;
    raterSessionId : Text;
    targetSessionId : Text;
    stars : Nat;
  };

  // --- State Management ---
  let sessions = Map.empty<Text, Session>();
  var rideRequests = Map.empty<Text, RideRequest>();
  let messages = Map.empty<Text, List.List<ChatMessage>>();
  let ratings = Map.empty<Text, Rating>();
  var nonce : Nat = 0;

  func getSession(sessionId : Text) : Session {
    switch (sessions.get(sessionId)) {
      case (?session) { session };
      case (null) { Runtime.trap("Invalid session") };
    };
  };

  // Mark all internal helper functions as "private" (no need to expose as public/shared).
  func calculatePriceAndRoute(pickup : Text, dropoff : Text, nonce : Nat) : (Nat, Nat, Nat, Text) {
    let baseFare = 1000;
    let pickupLength = pickup.size();
    let dropoffLength = dropoff.size();
    let distance = ((pickupLength + dropoffLength + nonce.toText().size()) * 2) % 30 + 2;
    let duration = distance * 3;
    let trafficLevel = switch (distance % 3) {
      case (0) { "Low" };
      case (1) { "Moderate" };
      case (_) { "High" };
    };
    let price = baseFare + (distance * 120) + duration * 3 +
      (if (trafficLevel == "High") { 450 } else if (trafficLevel == "Moderate") { 250 } else { 0 });

    (if (price > 2800) { 2800 } else if (price < 800) { 800 } else { price }, distance, duration, trafficLevel);
  };

  // --- Authorization Wrapper for Protecting Session Functions ---
  public shared ({ caller }) func createSession(role : Text) : async Text {
    // Any user (including guests) can create a new session
    nonce += 1;
    let id = "session" # nonce.toText();
    let newSession : Session = {
      role;
      trustScore = 75;
      rideCount = 0;
    };
    sessions.add(id, newSession);
    id;
  };

  public shared ({ caller }) func createRideRequest(riderSessionId : Text, encryptedPickup : Text, encryptedDropoff : Text, phantomMode : Bool) : async (Text, Text) {
    // Any user can create a new ride request
    let _ = getSession(riderSessionId); // Verify session exists
    nonce += 1;
    let rideId = "ride" # nonce.toText();
    let sessionCode = "code" # nonce.toText();

    let (price, distance, duration, trafficLevel) = calculatePriceAndRoute(encryptedPickup, encryptedDropoff, nonce);

    let newRide : RideRequest = {
      id = rideId;
      riderSessionId;
      encryptedPickup;
      encryptedDropoff;
      sessionCode;
      expiresAt = 0;
      status = "awaiting_approval";
      driverSessionId = null;
      phantomMode;
      riderTrust = "Standard";
      aiPrice = price;
      distanceKm = distance;
      durationMin = duration;
      trafficLevel;
    };
    rideRequests.add(rideId, newRide);
    (rideId, sessionCode);
  };

  public shared ({ caller }) func approveRide(rideId : Text, riderSessionId : Text) : async Bool {
    switch (rideRequests.get(rideId)) {
      case (?ride) {
        if (ride.riderSessionId == riderSessionId and ride.status == "awaiting_approval") {
          let updatedRide : RideRequest = {
            id = ride.id;
            riderSessionId;
            encryptedPickup = ride.encryptedPickup;
            encryptedDropoff = ride.encryptedDropoff;
            sessionCode = ride.sessionCode;
            expiresAt = ride.expiresAt;
            status = "approved";
            driverSessionId = ride.driverSessionId;
            phantomMode = ride.phantomMode;
            riderTrust = ride.riderTrust;
            aiPrice = ride.aiPrice;
            distanceKm = ride.distanceKm;
            durationMin = ride.durationMin;
            trafficLevel = ride.trafficLevel;
          };
          rideRequests.add(rideId, updatedRide);
          true;
        } else { false };
      };
      case (null) { false };
    };
  };

  public query ({ caller }) func listAvailableRides() : async [(Text, Text, Bool, Text, Nat, Nat, Nat, Text)] {
    // Anyone can query available rides
    let results = List.empty<(Text, Text, Bool, Text, Nat, Nat, Nat, Text)>();
    for ((rideId, ride) in rideRequests.entries()) {
      if (ride.status == "approved" and ride.driverSessionId == null) {
        results.add((rideId, ride.sessionCode, ride.phantomMode, ride.riderTrust, ride.aiPrice, ride.distanceKm, ride.durationMin, ride.trafficLevel));
      };
    };
    results.toArray();
  };

  public shared ({ caller }) func acceptRide(rideId : Text, driverSessionId : Text) : async Bool {
    // Any user can accept a ride as a driver
    let _ = getSession(driverSessionId); // Verify driver session exists
    switch (rideRequests.get(rideId)) {
      case (?ride) {
        if (ride.status != "approved" or ride.driverSessionId != null) {
          return false;
        };
        let updatedRide = {
          id = ride.id;
          riderSessionId = ride.riderSessionId;
          encryptedPickup = ride.encryptedPickup;
          encryptedDropoff = ride.encryptedDropoff;
          sessionCode = ride.sessionCode;
          expiresAt = ride.expiresAt;
          status = "matched";
          driverSessionId = ?driverSessionId;
          phantomMode = ride.phantomMode;
          riderTrust = ride.riderTrust;
          aiPrice = ride.aiPrice;
          distanceKm = ride.distanceKm;
          durationMin = ride.durationMin;
          trafficLevel = ride.trafficLevel;
        };
        rideRequests.add(rideId, updatedRide);
        true;
      };
      case (null) { false };
    };
  };

  func completeRide(rideId : Text, sessionId : Text, isDriver : Bool) : Bool {
    let ride = switch (rideRequests.get(rideId)) {
      case (?r) { r };
      case (_) { return false };
    };
    let session = getSession(sessionId);
    // Session-based authorization: only participant can update
    if (((not isDriver) and ride.riderSessionId != sessionId) 
      or (isDriver and ride.driverSessionId != ?sessionId)) {
      return false;
    };
    let updatedRide = {
      id = ride.id;
      riderSessionId = ride.riderSessionId;
      encryptedPickup = ride.encryptedPickup;
      encryptedDropoff = ride.encryptedDropoff;
      sessionCode = ride.sessionCode;
      expiresAt = ride.expiresAt;
      status = "completed";
      driverSessionId = ride.driverSessionId;
      phantomMode = ride.phantomMode;
      riderTrust = ride.riderTrust;
      aiPrice = ride.aiPrice;
      distanceKm = ride.distanceKm;
      durationMin = ride.durationMin;
      trafficLevel = ride.trafficLevel;
    };
    rideRequests.add(rideId, updatedRide);
    let updatedSession = {
      role = session.role;
      trustScore = session.trustScore + 2;
      rideCount = session.rideCount + 1;
    };
    sessions.add(sessionId, updatedSession);
    let driverId = switch (ride.driverSessionId) {
      case (?driverId) { driverId };
      case (null) { return true };
    };
    let driverSession = getSession(driverId);
    let updatedDriverSession = {
      role = driverSession.role;
      trustScore = driverSession.trustScore + 2;
      rideCount = driverSession.rideCount + 1;
    };
    sessions.add(driverId, updatedDriverSession);
    true;
  };

  func updateRideHelper(rideId : Text, sessionId : Text, newStatus : Text) : Bool {
    switch (rideRequests.get(rideId)) {
      case (?ride) {
        switch (newStatus) {
          case ("completed") {
            completeRide(rideId, sessionId, false);
          };
          case ("driver_completing") {
            completeRide(rideId, sessionId, true);
          };
          // For all other non-completion statuses:
          case (_) {
            let session = getSession(sessionId);
            // Session-based authorization: only participant can update
            if ((session.role == "rider" and ride.riderSessionId != sessionId) 
                or (session.role == "driver" and ride.driverSessionId != ?sessionId)) {
              return false;
            };
            let updatedRide = {
              id = ride.id;
              riderSessionId = ride.riderSessionId;
              encryptedPickup = ride.encryptedPickup;
              encryptedDropoff = ride.encryptedDropoff;
              sessionCode = ride.sessionCode;
              expiresAt = ride.expiresAt;
              status = newStatus;
              driverSessionId = ride.driverSessionId;
              phantomMode = ride.phantomMode;
              riderTrust = ride.riderTrust;
              aiPrice = ride.aiPrice;
              distanceKm = ride.distanceKm;
              durationMin = ride.durationMin;
              trafficLevel = ride.trafficLevel;
            };
            rideRequests.add(rideId, updatedRide);
            true;
          };
        };
      };
      case (null) { false };
    };
  };

  public shared ({ caller }) func updateRideStatus(rideId : Text, sessionId : Text, newStatus : Text) : async Bool {
    updateRideHelper(rideId, sessionId, newStatus);
  };

  public shared ({ caller }) func sendMessage(rideId : Text, senderSessionId : Text, encryptedText : Text) : async Bool {
    // Any user can send a message
    let senderRole = getSession(senderSessionId).role;
    let message : ChatMessage = {
      rideId;
      senderRole;
      encryptedText;
      timestamp = 0;
    };
    let existingMessages = switch (messages.get(rideId)) {
      case (?msgs) { msgs };
      case (null) { List.empty<ChatMessage>() };
    };
    existingMessages.add(message);
    messages.add(rideId, existingMessages);
    true;
  };

  public query ({ caller }) func getMessages(rideId : Text, requesterSessionId : Text) : async [(Text, Text, Int)] {
    switch (rideRequests.get(rideId)) {
      case (?ride) {
        // Session-based authorization: only participant can see
        if (ride.riderSessionId != requesterSessionId and ride.driverSessionId != ?requesterSessionId) {
          return [];
        };
        switch (messages.get(rideId)) {
          case (?msgs) {
            msgs.map<ChatMessage, (Text, Text, Int)>(
              func(msg) { (msg.senderRole, msg.encryptedText, msg.timestamp) }
            ).toArray();
          };
          case (null) { [] };
        };
      };
      case (null) { [] };
    };
  };

  public shared ({ caller }) func submitRating(rideId : Text, raterSessionId : Text, stars : Nat) : async Bool {
    if (stars < 1 or stars > 5) {
      return false;
    };
    switch (rideRequests.get(rideId)) {
      case (?ride) {
        if (ride.id != rideId or ride.status != "completed") {
          return false;
        };
        // Session-based authorization: only rider can rate
        if (ride.riderSessionId != raterSessionId) {
          return false;
        };
        switch (ride.driverSessionId) {
          case (?targetSessionId) {
            let rating : Rating = {
              rideId;
              raterSessionId;
              targetSessionId;
              stars;
            };
            ratings.add(rideId # "-" # raterSessionId, rating);
            true;
          };
          case (null) { false };
        };
      };
      case (null) { false };
    };
  };

  public query ({ caller }) func getReputation(sessionId : Text) : async (Text, Nat) {
    let session = getSession(sessionId);
    var trustLabel = "Unknown";
    if (session.trustScore > 90) {
      trustLabel := "Verified";
    } else if (session.trustScore > 75) {
      trustLabel := "Trusted";
    } else if (session.trustScore > 60) {
      trustLabel := "Standard";
    } else if (session.trustScore > 45) {
      trustLabel := "Developing";
    } else {
      trustLabel := "Needs Improvement";
    };
    (trustLabel, session.rideCount);
  };

  public shared ({ caller }) func endSession(sessionId : Text) : async Bool {
    if (not sessions.containsKey(sessionId)) {
      Runtime.trap("No session with id " # sessionId # " found.");
    };
    sessions.remove(sessionId);
    true;
  };

  public query ({ caller }) func heartbeatQuery() : async () {};
};
