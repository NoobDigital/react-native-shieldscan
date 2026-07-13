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

  s.source_files = "ios/**/*.{h,m,mm,swift}"

  # ✔ Correct dependencies for RN 0.73 NativeModule
  s.dependency 'React-Core'
  s.dependency 'React-CoreModules'
  s.dependency 'React'
end
