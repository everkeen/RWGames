// Main RW Games script for things not specific to a certain game on the website
// Mostly used for analytics.
function onLoad() {
    const hasVisited = localStorage.getItem("hasVisited");
    if (!hasVisited) {
        localStorage.setItem("hasVisited", "true");
        const counterUrl = "https://api.counterapi.dev/v2/everkeens-team-4116/rw-games-visits/up";
        fetch(counterUrl, { method: "GET" })
            .then(response => {
            if (!response.ok) {
                console.error("Failed to update visit counter:", response.statusText);
            }
        })
            .catch(error => {
            console.error("Error updating visit counter:", error);
        });
        console.log("Updated visit counter for RW Games");
    }
    console.log("Loading statistics...");
    const visitorCounterElements = document.querySelectorAll("[data-visit-counter]");
    console.log(`Found ${visitorCounterElements.length} visit counter elements`);
    visitorCounterElements.forEach(element => {
        const counterUrl = "https://api.counterapi.dev/v2/everkeens-team-4116/rw-games-visits";
        console.log(`Fetching visit counter from ${counterUrl} for element`, element);
        fetch(counterUrl, { method: "GET" })
            .then(response => {
            if (!response.ok) {
                console.error("Failed to fetch visit counter:", response.statusText);
                element.textContent = "Error loading visit count";
                return;
            }
            return response.json();
        })
            .then(data => {
            console.log("Received visit counter data:", data);
            const realData = data.data;
            if (realData && typeof realData.up_count === "number") {
                element.textContent = realData.up_count.toString();
            }
        })
            .catch(error => {
            console.error("Error fetching visit counter:", error);
            element.textContent = "Error loading visit count";
        });
    });
    console.log("Finished loading statistics");
}
document.addEventListener("DOMContentLoaded", onLoad);
export {};
//# sourceMappingURL=main.js.map