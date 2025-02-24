"use strict";

function playClickSound() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)(); // Создаём аудиоконтекст
  const oscillator = audioCtx.createOscillator(); // Генератор звука
  const gainNode = audioCtx.createGain(); // Управление громкостью

  oscillator.connect(gainNode); // Подключаем генератор к громкости
  gainNode.connect(audioCtx.destination); // Подключаем к динамикам

  oscillator.type = "sine"; // Тип волны (синусоида для мягкого звука)
  oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // Частота (800 Гц — лёгкий щелчок)
  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Громкость (0.1 — тихо)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05); // Затухание за 50 мс

  oscillator.start(audioCtx.currentTime); // Запускаем звук
  oscillator.stop(audioCtx.currentTime + 0.05); // Останавливаем через 50 мс
}

const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");

let userCoords; // Храним координаты пользователя

class Workout {
  date = new Date();
  id = (Date.now() + "").slice(-10);
  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }
  _setDescription() {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = "running";
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }
  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}
class Cycling extends Workout {
  type = "cycling";
  constructor(coords, distance, duration, elevation) {
    super(coords, distance, duration);
    this.elevation = elevation;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

class App {
  _workouts = [];
  _map;
  _mapEvent;
  _tempMarker;
  _clickCount = 0;
  _activeWorkout = null;
  constructor() {
    this._getPosition();

    // LS
    this._getLocalStorage();

    // добовляем марк с поп апам
    form.addEventListener("submit", this._newWorkout.bind(this));

    // меняем бег на вел
    inputType.addEventListener("change", this._toogleField);
    // закрываем треню еском
    document.addEventListener("keydown", this._handleKeydown.bind(this));
/*     document.addEventListener('click', () => {
      playClickSound()
    }) */
  }

  _handleKeydown(e) {
    if (e.key === "Escape" || e.keyCode === 27) {
      // Проверяем нажатие Esc
      if (this._activeWorkout) {
        // Если есть активная тренировка
        const workout = this._activeWorkout;
        if (workout.startMarker) {
          this._map.removeLayer(workout.startMarker);
          delete workout.startMarker;
        }
        if (workout.finishMarker) {
          this._map.removeLayer(workout.finishMarker);
          delete workout.finishMarker;
        }
        if (workout.routeLayer) {
          this._map.removeLayer(workout.routeLayer);
          delete workout.routeLayer;
        }
        this._activeWorkout = null; // Сбрасываем активную тренировку
      }
    }
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),

        function () {
          alert("Вы запретили доступ к геолокации!");
        }
      );
    }
    containerWorkouts.addEventListener("click", this._moveToPopup.bind(this));
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    userCoords = [latitude, longitude];
    this._map = L.map("map").setView(userCoords, 13);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this._map);

    L.marker(userCoords)
      .addTo(this._map)
      .bindPopup("A pretty CSS popup.<br> Easily customizable.");
    // Без .openPopup()

    this._map.on("click", this._handleMapClick.bind(this));

    const backButton = L.control({ position: "topright" });
    backButton.onAdd = function () {
      const button = L.DomUtil.create("button", "back-to-center");
      button.innerHTML = "Я тут";
      button.style.padding = "10px";
      button.style.cursor = "pointer";
      button.style.background = "rgba(255, 255, 255, 0.3)";
      button.style.backdropFilter = "blur(5px)";
      button.style.border = "2px solid #555";
      button.style.borderRadius = "5px";

      L.DomEvent.disableClickPropagation(button);
      L.DomEvent.stopPropagation(button);

      button.onclick = () => this._map.setView(userCoords, 13);
      return button;
    };
    backButton.addTo(this._map);

    // Рендерим только маркеры финиша для всех тренировок
    this._workouts.forEach((work) => {
      this._renderWorkMarke(work);
    });
  }

  _handleMapClick(mapE) {
    playClickSound()
    this._clickCount++;
    const { lat, lng } = mapE.latlng;

    // Кастомные иконки для старта и финиша
    const startIcon = L.icon({
      iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    const finishIcon = L.icon({
      iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    if (this._clickCount === 1) {
      // Первый клик — точка старта
      // Очищаем все существующие маркеры и маршруты тренировок
      this._workouts.forEach((w) => {
        if (w.startMarker) {
          this._map.removeLayer(w.startMarker);
          delete w.startMarker;
        }
        if (w.finishMarker) {
          this._map.removeLayer(w.finishMarker);
          delete w.finishMarker;
        }
        if (w.routeLayer) {
          this._map.removeLayer(w.routeLayer);
          delete w.routeLayer;
        }
      });

      // Очищаем временные маркеры и маршрут
      if (this._startMarker) this._map.removeLayer(this._startMarker);
      if (this._endMarker) this._map.removeLayer(this._endMarker);
      if (this._routeLayer) this._map.removeLayer(this._routeLayer);

      // Ставим новый маркер старта
      this._startMarker = L.marker([lat, lng], { icon: startIcon })
        .addTo(this._map)
        .bindPopup(
          L.popup({
            maxWidth: 250,
            minWidth: 100,
            autoClose: false,
            closeOnClick: false,
            className: "mark-popup",
          })
        )
        .setPopupContent("Точка старта")
        .openPopup();

      // Сбрасываем активную тренировку
      this._activeWorkout = null;
    } else if (this._clickCount === 2) {
      // Второй клик — точка финиша
      this._endMarker = L.marker([lat, lng], { icon: finishIcon })
        .addTo(this._map)
        .bindPopup(
          L.popup({
            maxWidth: 250,
            minWidth: 100,
            autoClose: false,
            closeOnClick: false,
            className: "mark-popup",
          })
        )
        .setPopupContent("Точка финиша")
        .openPopup();

      this._calculateRoute([lat, lng]);
      this._clickCount = 0; // Сброс счётчика
    }
  }

  _calculateRoute(endCoords) {
    const startCoords = this._startMarker.getLatLng();
    const url = `http://router.project-osrm.org/route/v1/driving/${startCoords.lng},${startCoords.lat};${endCoords[1]},${endCoords[0]}?overview=full&geometries=geojson`;

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        const route = data.routes[0].geometry;
        this._routeLayer = L.geoJSON(route, {
          style: { color: "#ff7800", weight: 5 },
        }).addTo(this._map);
        const distance = (data.routes[0].distance / 1000).toFixed(2); // Дистанция в км

        // Показываем форму и заполняем дистанцию
        form.classList.remove("hidden");
        inputDistance.value = distance;
        inputDuration.focus();

        // Сохраняем координаты для тренировки
        this._mapEvent = { latlng: { lat: endCoords[0], lng: endCoords[1] } };
      })
      .catch((error) => console.log("Ошибка маршрута:", error));
  }

  _showForm(mapE) {
    this._mapEvent = mapE;
    form.classList.remove("hidden");
    inputDistance.focus();

    if (this._tempMarker) this._map.removeLayer(this._tempMarker);
    // Создаём полупрозрачный маркер
    const { lat, lng } = mapE.latlng;
    this._tempMarker = L.marker([lat, lng], { opacity: 0.5 }).addTo(this._map);
  }
  _toogleField() {
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
  }
  _newWorkout(e) {
    e.preventDefault();

    const validInputs = (...inputs) =>
      inputs.every((inp) => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every((inp) => inp > 0);

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this._mapEvent.latlng;
    let workout;
    const startCoords = this._startMarker.getLatLng();

    if (type === "running") {
      const cadence = +inputCadence.value;
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        return alert("Необходимо ввести целое положительное число");
      }
      workout = new Running([lat, lng], distance, duration, cadence);
      workout.startCoords = [startCoords.lat, startCoords.lng];
    }

    if (type === "cycling") {
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        return alert("Необходимо ввести целое положительное число");
      }
      workout = new Cycling([lat, lng], distance, duration, elevation);
      workout.startCoords = [startCoords.lat, startCoords.lng];
    }

    // Очищаем предыдущую активную тренировку
    if (this._activeWorkout) {
      if (this._activeWorkout.startMarker)
        this._map.removeLayer(this._activeWorkout.startMarker);
      if (this._activeWorkout.finishMarker)
        this._map.removeLayer(this._activeWorkout.finishMarker);
      if (this._activeWorkout.routeLayer)
        this._map.removeLayer(this._activeWorkout.routeLayer);
      this._activeWorkout = null;
    }

    this._workouts.push(workout);
    this._renderWorkMarke(workout);
    this._renderWorout(workout);
    this._hideForm();
    this._setLocalStorage();

    if (this._startMarker) this._map.removeLayer(this._startMarker);
    if (this._endMarker) this._map.removeLayer(this._endMarker);
    if (this._routeLayer) this._map.removeLayer(this._routeLayer);
  }

  _renderWorkMarke(workout) {
    L.marker(workout.coords)
      .addTo(this._map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: true,
          closeOnClick: true,
          className: "mark-popup",
        })
      )
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`
      )
      .openPopup();
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        "";
    form.classList.add("hidden");
  }
  _renderWorout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
    <h2 class="workout__title">${workout.description}</h2>
    <div class="workout__details">
      <span class="workout__icon">${
        workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"
      }</span>
      <span class="workout__value">${workout.distance}</span>
      <span class="workout__unit">км</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⏱</span>
      <span class="workout__value">${workout.duration}</span>
      <span class="workout__unit">мин</span>
    </div>`;
    if (workout.type === "running") {
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">мин/км</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">шаг</span>
          </div>
        </li>
        
      `;
    }
    if (workout.type === "cycling") {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">км/час</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevation}</span>
          <span class="workout__unit">м</span>
        </div>
      </li> 
      `;
    }
    form.insertAdjacentHTML("afterend", html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest(".workout");
    if (!workoutEl) return;

    const workout = this._workouts.find(
      (work) => work.id === workoutEl.dataset.id
    );
    if (!workout) return;

    if (this._activeWorkout === workout) {
      if (workout.startMarker) {
        this._map.removeLayer(workout.startMarker);
        delete workout.startMarker;
      }
      if (workout.finishMarker) {
        this._map.removeLayer(workout.finishMarker);
        delete workout.finishMarker;
      }
      if (workout.routeLayer) {
        this._map.removeLayer(workout.routeLayer);
        delete workout.routeLayer;
      }
      this._activeWorkout = null;
      return;
    }

    this._workouts.forEach((w) => {
      if (w.startMarker) {
        this._map.removeLayer(w.startMarker);
        delete w.startMarker;
      }
      if (w.finishMarker) {
        this._map.removeLayer(w.finishMarker);
        delete w.finishMarker;
      }
      if (w.routeLayer) {
        this._map.removeLayer(w.routeLayer);
        delete w.routeLayer;
      }
    });

    this._activeWorkout = workout;

    this._map.setView(workout.coords, 13, {
      animate: true,
      pan: { duration: 1 },
    });

    const startIcon = L.icon({
      iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    const finishIcon = L.icon({
      iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    if (workout.startCoords) {
      workout.startMarker = L.marker(workout.startCoords, { icon: startIcon })
        .addTo(this._map)
        .bindPopup(
          L.popup({
            maxWidth: 250,
            minWidth: 100,
            autoClose: false,
            closeOnClick: false,
            className: "mark-popup",
          })
        )
        .setPopupContent("Точка старта")
        .openPopup();

      workout.finishMarker = L.marker(workout.coords, { icon: finishIcon })
        .addTo(this._map)
        .bindPopup(
          L.popup({
            maxWidth: 250,
            minWidth: 100,
            autoClose: false,
            closeOnClick: false,
            className: "mark-popup",
          })
        )
        .setPopupContent(
          `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`
        )
        .openPopup();

      const url = `http://router.project-osrm.org/route/v1/driving/${workout.startCoords[1]},${workout.startCoords[0]};${workout.coords[1]},${workout.coords[0]}?overview=full&geometries=geojson`;
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          const route = data.routes[0].geometry;
          workout.routeLayer = L.geoJSON(route, {
            style: { color: "#ff7800", weight: 5 },
          }).addTo(this._map);
        })
        .catch((error) => console.log("Ошибка маршрута:", error));
    }
  }

  _setLocalStorage() {
    localStorage.setItem("workouts", JSON.stringify(this._workouts));
  }

  _getLocalStorage() {
    const dataWork = JSON.parse(localStorage.getItem("workouts"));
    if (!dataWork) return;

    this._workouts = dataWork;

    this._workouts.forEach((work) => {
      this._renderWorout(work);
    });

    if (this._map) {
      this._workouts.forEach((work) => {
        this._renderWorkMarke(work); // Рендерим только маркеры финиша
      });
    }
  }

  rest() {
    localStorage.removeItem("workouts");
    location.reload();
  }
}

const app = new App();
//app._getPosition;

// Создаём кнопку
const submitButton = document.createElement("button");
submitButton.type = "submit"; // Делаем её кнопкой отправки формы
submitButton.textContent = "Записать"; // Текст на кнопке
// Стили
submitButton.style.padding = "10px 15px";
submitButton.style.marginTop = "10px";
submitButton.style.cursor = "pointer";
// Добавляем кнопку в форму
form.appendChild(submitButton);

const resetBtn = document.createElement("button");
resetBtn.textContent = "Сбросить";
resetBtn.style.position = "absolute";
resetBtn.style.top = "50px";
resetBtn.style.right = "50px";
resetBtn.style.padding = "10px";
resetBtn.style.background = "rgba(255, 255, 255, 0.3)"; // Полупрозрачный белый фон
resetBtn.style.backdropFilter = "blur(5px)"; // Размытие фона
resetBtn.style.color = "#fff";
resetBtn.style.border = "none";
resetBtn.style.borderRadius = "5px";
resetBtn.style.cursor = "pointer";

document.querySelector(".sidebar").appendChild(resetBtn);

resetBtn.addEventListener("click", function () {
  app.rest();
});
