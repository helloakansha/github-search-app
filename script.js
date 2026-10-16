
const searchInput = document.getElementById("searchInput");
const results = document.getElementById("results");
const status = document.getElementById("status");

let debounceTimer;
let controller;

// Escape text before inserting API values into HTML.
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// Search when the user types.
searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);

  // Cancel the previous request, if any.
  if (controller) {
    controller.abort();
  }

  const username = searchInput.value.trim();

  results.replaceChildren();

  if (!username) {
    status.textContent = "Try searching for octocat.";
    status.className = "";
    return;
  }

  status.textContent = "Waiting for you to finish typing...";
  status.className = "";

  debounceTimer = setTimeout(() => {
    searchUsers(username);
  }, 500);
});

async function searchUsers(username) {
  // Search multiple accounts matching the username.
  const url =
    `https://api.github.com/search/users?q=${encodeURIComponent(username)}&per_page=10`;

  controller = new AbortController();
  const currentController = controller;

  status.textContent = "Loading users...";

  try {
    const response = await fetch(url, {
      signal: currentController.signal
    });

    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        throw new Error(
          "API rate limit reached. Please wait and try again."
        );
      }

      throw new Error(
        `Request failed (${response.status}). Please try again.`
      );
    }

    const data = await response.json();

    // Ignore results if a newer request has started.
    if (controller !== currentController) return;

    if (data.items.length === 0) {
      status.textContent = "No GitHub users found.";
      return;
    }

    status.textContent =
      `Found ${data.total_count} matching users. Showing up to 10.`;

    results.innerHTML = data.items.map(user => `
      <article class="card">
        <img
          class="avatar"
          src="${escapeHTML(user.avatar_url)}"
          alt="${escapeHTML(user.login)}'s avatar"
          loading="lazy"
        >

        <h2>${escapeHTML(user.login)}</h2>

        <p>GitHub account</p>

        <a
          href="${escapeHTML(user.html_url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          View profile →
        </a>
      </article>
    `).join("");

    // Fetch detailed information for each matching account.
    await Promise.all(
      [...results.querySelectorAll(".card")].map(
        async (card, index) => {
          const user = data.items[index];

          try {
            const profileResponse = await fetch(
              `https://api.github.com/users/${encodeURIComponent(user.login)}`,
              { signal: currentController.signal }
            );

            if (!profileResponse.ok) return;

            const profile = await profileResponse.json();

            if (controller !== currentController) return;

            const details = document.createElement("div");
            details.className = "stats";

            const bio = document.createElement("p");
            bio.textContent = profile.bio || "No bio provided";

            const stats = document.createElement("p");
            stats.textContent =
              `Followers: ${profile.followers} · Repos: ${profile.public_repos}`;

            card.append(bio, stats);
          } catch (error) {
            if (error.name !== "AbortError") {
              console.error("Could not load profile details:", error);
            }
          }
        }
      )
    );

  } catch (error) {
    if (error.name === "AbortError") return;

    if (controller !== currentController) return;

    results.replaceChildren();
    status.textContent = error.message ||
      "Something went wrong. Please try again.";
    status.className = "error";
  }
}
