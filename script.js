// js/script.js

document.addEventListener('DOMContentLoaded', () => {
    // The protectPage() function is now called AFTER the DOM is loaded.
    protectPage().then(({ user, role }) => { // Destructure to get both user and role
        // This code will only run if the user is successfully logged in.
        console.log('Dashboard script initialized for user:', user.email, 'with role:', role);

        // Add a "Viewer Mode" banner and disable features if the user is not an editor.
        if (role !== 'editor') {
            document.body.classList.add('viewer-mode');
            const viewerBanner = document.createElement('div');
            viewerBanner.textContent = 'Read-Only Viewer Mode';
            viewerBanner.className = 'viewer-banner';
            document.body.prepend(viewerBanner);
        }

        // --- Part 1: Update Bed Status Cards ---
        function updateBedStatusCards() {
            const departmentData = {
                ER:         { name: "Emergency Room", totalBeds: 14 },
                Gynecology: { name: "Gynecology",     totalBeds: 8 },
                IM:         { name: "Internal Medicine", totalBeds: 11 },
                Pediatric:  { name: "Pediatrics",     totalBeds: 6 },
                Surgery:    { name: "Surgery",        totalBeds: 15 },
                Private:    { name: "Private Ward",   totalBeds: 12 } // ADDED THIS LINE
            };

            document.querySelectorAll('.card').forEach(card => {
                const departmentId = card.dataset.department;
                if (departmentData[departmentId]) {
                    const data = departmentData[departmentId];
                    const totalBeds = data.totalBeds;
                    const storageKey = `hmhmo_${departmentId}_history`;
                    const history = JSON.parse(localStorage.getItem(storageKey) || '{}');
                    const today = new Date().toISOString().slice(0, 10);
                    const occupiedBeds = history[today] ?? 0;
                    
                    const availableBeds = totalBeds - occupiedBeds;
                    const occupancyPercentage = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;

                    card.querySelector('.occupied-beds').textContent = occupiedBeds;
                    card.querySelector('.available-beds').textContent = availableBeds;
                    card.querySelector('.total-beds').textContent = totalBeds;
                    
                    const statusBar = card.querySelector('.status-bar-foreground');
                    if (statusBar) {
                        statusBar.style.width = `${occupancyPercentage}%`;
                        if (occupancyPercentage > 85) statusBar.style.backgroundColor = '#d9534f';
                        else if (occupancyPercentage > 60) statusBar.style.backgroundColor = '#f0ad4e';
                        else statusBar.style.backgroundColor = '#5cb85c';
                    }
                }
            });
        }

        // --- Part 2: Render the ER Occupancy Chart ---
        function renderErChart() {
            const ctx = document.getElementById('er-occupancy-chart');
            if (!ctx) return;

            const storageKey = 'hmhmo_ER_history';
            const history = JSON.parse(localStorage.getItem(storageKey) || '{}');

            const labels = [];
            const dataPoints = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateString = date.toISOString().slice(0, 10);
                
                labels.push(dateString);
                dataPoints.push(history[dateString] || 0);
            }
            
            const existingChart = Chart.getChart(ctx);
            if (existingChart) {
                existingChart.destroy();
            }

            new Chart(ctx, {
                type: 'line',
                data: { labels: labels, datasets: [{ label: 'Occupied Beds', data: dataPoints, borderColor: '#007aff', backgroundColor: 'rgba(0, 122, 255, 0.1)', fill: true, tension: 0.4 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { color: '#a0a0a0', stepSize: 1 }, grid: { color: '#333' } }, x: { ticks: { color: '#a0a0a0' }, grid: { display: false } } }, plugins: { legend: { display: false } } }
            });
        }

        // --- Run everything ---
        updateBedStatusCards();
        renderErChart();

        window.addEventListener('storage', () => {
            updateBedStatusCards();
            renderErChart(); 
        });

    }).catch(error => {
        // This will catch the 'No user logged in' rejection and prevent errors in the console.
        console.error(error);
    });
});
