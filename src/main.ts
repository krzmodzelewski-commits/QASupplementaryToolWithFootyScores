import './style.css';

class Main {
    private readonly app: HTMLElement;

    constructor() {
        const app = document.querySelector<HTMLElement>('#app');

        if (!app) {
            throw new Error('The #app element is missing from the document.');
        }

        this.app = app;
        this.render();
        this.app.addEventListener('click', () => {
            window.location.assign('matches-dashboard.html');
        });
        window.setTimeout(() => {
            window.location.assign('matches-dashboard.html');
        }, 3000);
    }

    private render(): void {
        const olympicsLogo = document.createElement('img');
        olympicsLogo.src = new URL(
            '../resources/images/2024_summer_olympics_logo.svg.webp',
            import.meta.url,
        ).href;
        olympicsLogo.alt = '2024 Summer Olympics logo';

        const secondImage = document.createElement('img');
        secondImage.src = new URL(
            '../resources/images/2024_summer_olympics_football_logo.jpg',
            import.meta.url,
        ).href;
        secondImage.alt = '2024 Summer Olympics football logo';

        this.app.append(olympicsLogo, secondImage);
    }
}

new Main();