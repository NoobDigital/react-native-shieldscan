package com.shieldscan;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.turbomodule.core.interfaces.TurboModule;

public interface ShieldScanSpec extends TurboModule {
  java.util.Map<String, Object> runSecurityChecks();
}