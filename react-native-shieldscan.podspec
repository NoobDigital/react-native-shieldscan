require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-shieldscan"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => "13.0" }

  s.source       = {
    :git => "https://github.com/NoobDigital/react-native-shieldscan.git",
    :tag => "#{s.version}"
  }

  # Include both Swift implementation and Obj-C bridge
  s.source_files = "ios/**/*.{h,m,mm,swift}"

  # React Native New Architecture support.
  # install_modules_dependencies handles:
  #   - Linking React-Core for Old Arch
  #   - Linking ReactCommon/turbomodule/core for New Arch
  #   - Setting the REACT_NATIVE_TARGET_VERSION for codegen
  install_modules_dependencies(s)
end
