import "./main"

export default defineContentScript({
  matches: ['*://*.google.com/*'],
  main() {
    console.log("Hello Content")
  },
});
