function loadLeftSideBar() {
    fetch("left-sidebar.html")
        .then(response => response.text())
        .then(html => {
            setTimeout(() => {
                document.getElementById("left-sidebar-placeholder").innerHTML = html;
            }, 100);
        })
        .catch(error => console.warn("Error loading left-sidebar:", error));
}

window.onload = loadLeftSideBar;