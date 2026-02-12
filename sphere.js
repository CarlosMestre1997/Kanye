// Sphere Background Animation using Three.js
// Converted from React/TypeScript to vanilla JS

const SphereBackground = {
    scene: null,
    camera: null,
    renderer: null,
    points: null,
    animationFrameId: null,

    init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.z = 3;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(width, height);
        container.appendChild(this.renderer.domElement);

        // Sphere parameters
        const radius = 1.5;
        const detail = 40;
        const particleSizeMin = 0.01;
        const particleSizeMax = 0.08;

        // Geometry
        const geometry = new THREE.IcosahedronGeometry(1, detail);
        
        // Texture
        const texture = this.createDotTexture(32, "#FFFFFF");
        
        // Material - Twitter blue color
        const material = new THREE.PointsMaterial({
            map: texture,
            blending: THREE.AdditiveBlending,
            color: 0x1da1f2,
            depthTest: false,
        });

        // Setup custom shader
        this.setupPointsShader(material, { radius, particleSizeMin, particleSizeMax });

        // Create points
        this.points = new THREE.Points(geometry, material);
        this.scene.add(this.points);

        // Start animation
        this.animate(0);

        // Handle resize
        window.addEventListener("resize", () => this.handleResize());
    },

    createDotTexture(size = 32, color = "#FFFFFF") {
        const radius = size * 0.5;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        const circle = new Path2D();
        circle.arc(radius, radius, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill(circle);

        return new THREE.CanvasTexture(canvas);
    },

    setupPointsShader(material, opts) {
        const { radius, particleSizeMin, particleSizeMax } = opts;
        
        material.onBeforeCompile = (shader) => {
            shader.uniforms.time = { value: 0 };
            shader.uniforms.radius = { value: radius };
            shader.uniforms.particleSizeMin = { value: particleSizeMin };
            shader.uniforms.particleSizeMax = { value: particleSizeMax };

            shader.vertexShader = "uniform float particleSizeMax;\n" + shader.vertexShader;
            shader.vertexShader = "uniform float particleSizeMin;\n" + shader.vertexShader;
            shader.vertexShader = "uniform float radius;\n" + shader.vertexShader;
            shader.vertexShader = "uniform float time;\n" + shader.vertexShader;
            shader.vertexShader = this.webGlNoise + "\n" + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
                "#include <begin_vertex>",
                `
                vec3 p = position;
                float n = snoise( vec3( p.x*.6 + time*0.2, p.y*0.4 + time*0.3, p.z*.2 + time*0.2) );
                p += n *0.4;

                float l = radius / length(p);
                p *= l;
                float s = mix(particleSizeMin, particleSizeMax, n);
                vec3 transformed = vec3( p.x, p.y, p.z );
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                "gl_PointSize = size;",
                "gl_PointSize = s;"
            );

            material.userData.shader = shader;
        };
    },

    animate(timeMs) {
        const time = timeMs * 0.001;
        
        if (this.points) {
            this.points.rotation.set(0, time * 0.2, 0);
        }
        
        const shader = this.points?.material?.userData?.shader;
        if (shader) {
            shader.uniforms.time.value = time;
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
        
        this.animationFrameId = requestAnimationFrame((t) => this.animate(t));
    },

    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        if (this.camera) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }
        
        if (this.renderer) {
            this.renderer.setSize(width, height);
        }
    },

    // Simplex noise GLSL code
    webGlNoise: `
vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
    return mod289(((x*34.0)+10.0)*x);
}

vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    SphereBackground.init('sphere-background');
});
