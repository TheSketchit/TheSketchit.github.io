function loadFooter() {
    fetch("footer.html")
        .then(response => response.text())
        .then(html => {
            document.getElementById("footer-placeholder").innerHTML = html;
        })
        .catch(error => console.warn("Error loading footer:", error));
}

document.addEventListener("DOMContentLoaded", loadFooter);