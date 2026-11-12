export interface DiscoveryStartupDependencies {
  initializeDatabase:()=>Promise<{success:boolean;mode:string}>;
  initializeDirectory:()=>Promise<void>;
}
/** Discovery startup deliberately has no treasury, withdrawal, worker or provider capability. */
export async function startDiscoveryServices(dependencies:DiscoveryStartupDependencies) {
  try {
    const database=await dependencies.initializeDatabase();
    if(!database.success)return {success:false,dbMode:database.mode,treasuryStatus:'DISABLED',liveReady:false,errors:['DATABASE_NOT_READY']};
    await dependencies.initializeDirectory();
    return {success:true,dbMode:database.mode,treasuryStatus:'DISABLED',liveReady:false};
  } catch {return {success:false,dbMode:'UNAVAILABLE',treasuryStatus:'DISABLED',liveReady:false,errors:['DISCOVERY_STARTUP_FAILED']};}
}
