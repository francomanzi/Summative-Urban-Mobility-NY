//Talks to the API and draws the cards,insights, charts and table
let page= 1;
const charts={}; // keeps the drawn charts so we can destory old ones

function getFilters(){ 
    const ids = ['borough', 'from', 'to', 'minDistance', 'maxDistance', 'minFare', 'maxFare'];
    const params=new URLSearchParams(); for (const id of ids) {
         const value= document.getElementById(id).value;
          if(value) params.set(id, value);
    }
    return params;
}
async function getData(url,params){
    const response= await fetch(url+'?'+ params.toString());
    return response.json();
}
function drawChart(canvasId, type, labels, numbers, title, color){
    if (charts[canvasId]) charts[canvasId].destroy();
    charts[canvasId] = new Chart(document.getElementById(canvasId), {
        type:type,
        data: {labels: labels,datasets:[{label: title, data:numbers, backgroundColor: color, borderColor: color}]},
        options: {indexAxis: canvasId=== 'zoneChart' ? 'y': 'x', maintainAspectRatio: false, animation:false},
    });
    }
    //Top header numbers: total trips, average fare and the rough total revenue
    function showHeaderStats(s) {
        const revenue= (s.trips || 0)*(s.avg_fare || 0);
        document.getElementById('headerStats').innerHTML =
    `<div class="stat"><b>${(s.trips || 0).toLocaleString()}</b><span>Trips</span></div>
     <div class="stat"><b>$${(s.avg_fare || 0).toFixed(2)}</b><span>Avg fare</span></div>
     <div class="stat"><b>$${revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b><span>Est. fare revenue</span></div>`;
    }
    function showSummary(s) {
        document.getElementById('summary').innerHTML=
            `<div class="card"><b>${s.trips.toLocaleString()}</b>trips</div>
     <div class="card"><b>${(s.avg_distance || 0).toFixed(1)} mi</b>average distance</div>
     <div class="card"><b>$${(s.avg_fare || 0).toFixed(2)}</b>average fare</div>
     <div class="card"><b>${(s.avg_speed || 0).toFixed(1)} mph</b>average speed</div>
     <div class="card"><b>${(s.avg_tip_percent || 0).toFixed(1)}%</b>average card tip</div>`;
}

        function showCharts(hours,zones){
            const hourLabels= hours.map(h => h.hour + ':00');
            drawChart('hourChart','bar', hourLabels,hours.map(h=> h.trips), 'Trips','#f7c600');
            drawChart('speedChart','line',hourLabels, hours.map(h=> h.avg_speed), 'Average mph','#2a7de1');

            const zoneLabels = zones.map(z => z.name);
  drawChart('zoneChart', 'bar', zoneLabels, zones.map(z => z.trips), 'Trips', '#e1572a');
}
            //Three short readings of the current selection, rebuilt whenever the filters change 
            function showInsights(summary,hours,zones){
                const insights=[];
                
            //1. speed by hour: the slowest vs the fastest hour of the day
            const busy=hours.filter(h=> h.avg_speed>0);
            if(busy.length>1){
                let slow =busy[0], fast =busy[0];
                for (const h of busy){
                    if (h.avg_speed < slow.avg_speed) slow = h;
                    if (h.avg_speed > fast.avg_speed) fast =h;
                }
                const longer = Math.round((fast.avg_speed / slow.avg_speed - 1) * 100);
    insights.push(`Taxis go the slowest around ${slow.hour}:00 at ${slow.avg_speed.toFixed(1)} mph and
      the fastest around ${fast.hour}:00 at ${fast.avg_speed.toFixed(1)} mph. The slowest hour takes
      about ${longer}% longer than the fastest.`);
                }
                //2. fare per mile on short vs long trips
                if (summary.short_fare_per_mile && summary.long_fare_per_mile) {
                    const price = summary.short_fare_per_mile / summary.long_fare_per_mile;
    insights.push(`Trips of 2 miles or less cost $${summary.short_fare_per_mile.toFixed(2)} per mile.
      Longer trips cost $${summary.long_fare_per_mile.toFixed(2)} per mile.
      Short trips are ${price.toFixed(1)} times more expensive per mile.`);
                    }
                    //3. how concentrated pickups are
                    if (summary.trips > 0 && zones.length >0) {
                        const topShare = zones.reduce((sum, z) => sum + z.trips, 0) / summary.trips * 100;
                        const biggest = zones[0].trips / summary.trips * 100;
    insights.push(`The 10 busiest pickup zones handle ${topShare.toFixed(0)}% of all trips.
      ${zones[0].name} alone handles ${biggest.toFixed(0)}% of them.
      Most pickups happen in just a few places.`);
                        } 
                        document.getElementById('insights').innerHTML = insights
                        .map(text => `<div class="insight">${text}</div>`)
                        .join('');
                    }
                    async function showTrips(params) { 
                        params.set('sortBy', document.getElementById('sortBy').value);
                        params.set('order', document.getElementById('order').value);
                        params.set('page', page);
                        const trips = await getData('/api/trips', params);
                        if (trips.length === 0 &&  page >1) { page--; return showTrips(getFilters());}

                        let html ='';
                        for (const t of trips) {
                            const tip = t.tip_percent == null ? '-' : t.tip_percent.toFixed(1);
                            html += `<tr><td>${t.pickup_time}</td><td>${t.pickup_zone}</td><td>${t.dropoff_zone}</td>
                            <td>${t.trip_distance.toFixed(1)}</td><td>${t.trip_minutes.toFixed(0)}</td>
                            <td>$${t.fare_amount.toFixed(2)}</td><td>${tip}</td></tr>`; 
                        }
                        document.getElementById('tripRows').innerHTML = html;
                        document.getElementById('pageNumber').textContent = page;
                        document.getElementById('nextButton').disabled = trips.length < 15;
                        document.getElementById('previousButton').disabled = page === 1; 
                    }
                    async function refreshDashboard() {
                        const params = getFilters();
                        try {
                            // fetch everything at once, then draw it (also shows the load error if the server is down)
                            const [summary, hours, zones] = await Promise.all([ 
                                getData('/api/summary', params),
                                getData('/api/trips-by-hour', params),
                                getData('/api/top-zones', params),
                            ]);
                            showHeaderStats( summary);
                            showSummary(summary);
                            showInsights(summary, hours, zones);
                            showCharts(hours, zones);
                            document.getElementById('errorBox').hidden = true;
                            await showTrips(params);
                        } catch (error) {
                            const box = document.getElementById('errorBox');
                            box.textContent = 'Could not load the data - is the server running? (' + error.message + ')';
                            box.hidden = false;
                        }
                    }
 document.getElementById('applyButton').addEventListener('click', () => { page = 1; refreshDashboard(); });
document.getElementById('nextButton').addEventListener('click', () => { page++; showTrips(getFilters()); });
document.getElementById('previousButton').addEventListener('click', () => { page--; showTrips(getFilters()); });

// Tabs switch which view is visible; charts hidden while hidden need a resize when shown
for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
    for(const t of document.querySelectorAll('.tab')) t.classList.remove('active');
    for (const v of document.querySelectorAll('.view')) v.classList.remove('active');
    tab.classList.add('active');
    document.getElementById(tab.dataset.view).classList.add('active');
    for (const chart of Object.values(charts)) chart.resize();
    });    
    }
    // Fill the borough draw everything for the first time
    async function startDashboard() {
        try{
        const boroughs = await (await fetch('/api/boroughs')).json();
        for (const b of boroughs){
        document.getElementById('borough').innerHTML += `<option>${b.borough_name}</option>`;
    }
} catch (error) {
    const box = document.getElementById('errorBox');
    box.textContent = 'Could not reach the server — is it running? (' + error.message + ')';
    box.hidden = false;
  }
  refreshDashboard();
}
startDashboard();


                                                                      
                                                                                                                      

                
            
        
