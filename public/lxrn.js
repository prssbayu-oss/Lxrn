// LXRN 3D Engine - Pure WebGL Native
// Luxarion Graphics Library v1.0.0

const LXRN = (function() {
    const VERSION = '1.0.0';
    const NAME = 'Luxarion 3D Engine';

    class Scene {
        constructor() {
            this.objects = [];
            this.camera = null;
            this.renderer = null;
            this.background = [0.1, 0.05, 0.15, 1.0];
        }

        add(object) {
            this.objects.push(object);
            return this;
        }

        setBackground(r, g, b, a = 1.0) {
            this.background = [r, g, b, a];
        }
    }

    class Camera {
        constructor(fov = 75, aspect = 1, near = 0.1, far = 100) {
            this.fov = fov;
            this.aspect = aspect;
            this.near = near;
            this.far = far;
            this.position = [0, 0, 5];
            this.rotation = [0, 0, 0];
            this.target = [0, 0, 0];
        }

        lookAt(x, y, z) {
            this.target = [x, y, z];
        }

        setPosition(x, y, z) {
            this.position = [x, y, z];
        }
    }

    class Renderer {
        constructor(canvas) {
            this.canvas = canvas || document.createElement('canvas');
            this.gl = this.canvas.getContext('webgl', { 
                antialias: true,
                alpha: true 
            });
            
            if (!this.gl) {
                throw new Error('LXRN: WebGL not supported');
            }

            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            this.gl.enable(this.gl.DEPTH_TEST);
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        }

        setSize(width, height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.gl.viewport(0, 0, width, height);
        }

        render(scene) {
            const gl = this.gl;
            
            // Clear with background color
            const bg = scene.background;
            gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            // Simple projection matrix (perspective)
            const aspect = this.canvas.width / this.canvas.height;
            const fov = scene.camera ? scene.camera.fov : 75;
            const near = scene.camera ? scene.camera.near : 0.1;
            const far = scene.camera ? scene.camera.far : 100;
            
            const f = 1.0 / Math.tan(fov * Math.PI / 360);
            const projMatrix = [
                f / aspect, 0, 0, 0,
                0, f, 0, 0,
                0, 0, (far + near) / (near - far), -1,
                0, 0, (2 * far * near) / (near - far), 0
            ];

            // Simple view matrix (look at)
            const camPos = scene.camera ? scene.camera.position : [0, 0, 5];
            const camTarget = scene.camera ? scene.camera.target : [0, 0, 0];
            
            const viewMatrix = this.createLookAt(camPos, camTarget);

            // Render each object
            for (const obj of scene.objects) {
                this.renderObject(obj, projMatrix, viewMatrix);
            }
        }

        createLookAt(eye, target) {
            const [ex, ey, ez] = eye;
            const [tx, ty, tz] = target;
            
            const zx = ex - tx;
            const zy = ey - ty;
            const zz = ez - tz;
            const zLen = Math.sqrt(zx*zx + zy*zy + zz*zz);
            const fzx = zx / zLen;
            const fzy = zy / zLen;
            const fzz = zz / zLen;
            
            const upx = 0, upy = 1, upz = 0;
            const ux = upy * fzz - upz * fzy;
            const uy = upz * fzx - upx * fzz;
            const uz = upx * fzy - upy * fzx;
            const uLen = Math.sqrt(ux*ux + uy*uy + uz*uz);
            const ufx = ux / uLen;
            const ufy = uy / uLen;
            const ufz = uz / uLen;
            
            const vx = fzy * ufz - fzz * ufy;
            const vy = fzz * ufx - fzx * ufz;
            const vz = fzx * ufy - fzy * ufx;
            
            return [
                ufx, ufy, ufz, -(ufx*ex + ufy*ey + ufz*ez),
                vx, vy, vz, -(vx*ex + vy*ey + vz*ez),
                fzx, fzy, fzz, -(fzx*ex + fzy*ey + fzz*ez),
                0, 0, 0, 1
            ];
        }

        renderObject(obj, projMatrix, viewMatrix) {
            const gl = this.gl;
            const verts = obj.geometry.vertices;
            const indices = obj.geometry.indices;
            const colors = obj.geometry.colors || this.generateColors(verts.length, obj.material.color);
            
            // Create buffers
            const vertBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
            
            const colorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
            
            const indexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

            // Build model matrix (rotation)
            const rot = obj.rotation || [0, 0, 0];
            const pos = obj.position || [0, 0, 0];
            const scale = obj.scale || [1, 1, 1];
            
            const modelMatrix = this.createModelMatrix(rot, pos, scale);
            
            // Combine matrices
            const mvMatrix = this.multiplyMatrices(viewMatrix, modelMatrix);
            const mvpMatrix = this.multiplyMatrices(projMatrix, mvMatrix);

            // Shader program
            const program = this.createProgram(gl);
            gl.useProgram(program);

            // Set uniforms
            const mvpLoc = gl.getUniformLocation(program, 'uMVP');
            gl.uniformMatrix4fv(mvpLoc, false, new Float32Array(mvpMatrix));

            // Set attributes
            const posLoc = gl.getAttribLocation(program, 'aPosition');
            gl.enableVertexAttribArray(posLoc);
            gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
            gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

            const colorLoc = gl.getAttribLocation(program, 'aColor');
            gl.enableVertexAttribArray(colorLoc);
            gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
            gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);

            // Draw
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
        }

        createModelMatrix(rot, pos, scale) {
            const [rx, ry, rz] = rot;
            const [px, py, pz] = pos;
            const [sx, sy, sz] = scale;

            // Rotation matrices
            const cx = Math.cos(rx), sx_r = Math.sin(rx);
            const cy = Math.cos(ry), sy_r = Math.sin(ry);
            const cz = Math.cos(rz), sz_r = Math.sin(rz);

            const rotX = [
                1, 0, 0, 0,
                0, cx, -sx_r, 0,
                0, sx_r, cx, 0,
                0, 0, 0, 1
            ];

            const rotY = [
                cy, 0, sy_r, 0,
                0, 1, 0, 0,
                -sy_r, 0, cy, 0,
                0, 0, 0, 1
            ];

            const rotZ = [
                cz, -sz_r, 0, 0,
                sz_r, cz, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ];

            let mat = this.multiplyMatrices(rotZ, this.multiplyMatrices(rotY, rotX));
            
            // Scale
            mat[0] *= sx; mat[5] *= sy; mat[10] *= sz;
            
            // Translate
            mat[12] = px;
            mat[13] = py;
            mat[14] = pz;

            return mat;
        }

        multiplyMatrices(a, b) {
            const result = new Array(16);
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    let sum = 0;
                    for (let k = 0; k < 4; k++) {
                        sum += a[i*4 + k] * b[k*4 + j];
                    }
                    result[i*4 + j] = sum;
                }
            }
            return result;
        }

        createProgram(gl) {
            const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, `
                attribute vec3 aPosition;
                attribute vec4 aColor;
                uniform mat4 uMVP;
                varying vec4 vColor;
                void main() {
                    gl_Position = uMVP * vec4(aPosition, 1.0);
                    vColor = aColor;
                }
            `);

            const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, `
                precision mediump float;
                varying vec4 vColor;
                void main() {
                    gl_FragColor = vColor;
                }
            `);

            const program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error('LXRN: Shader link failed');
            }

            return program;
        }

        createShader(gl, type, source) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);

            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('LXRN: Shader compile failed:', gl.getShaderInfoLog(shader));
            }

            return shader;
        }

        generateColors(count, baseColor = [0.5, 0.2, 0.8]) {
            const colors = [];
            for (let i = 0; i < count; i++) {
                colors.push(baseColor[0] + (Math.random() - 0.5) * 0.3);
                colors.push(baseColor[1] + (Math.random() - 0.5) * 0.3);
                colors.push(baseColor[2] + (Math.random() - 0.5) * 0.3);
                colors.push(1.0);
            }
            return colors;
        }
    }

    class Geometry {
        constructor(vertices, indices) {
            this.vertices = vertices;
            this.indices = indices;
            this.colors = null;
        }

        static Box(width = 1, height = 1, depth = 1) {
            const w = width / 2;
            const h = height / 2;
            const d = depth / 2;
            
            const verts = [
                -w, -h, -d,  w, -h, -d,  w,  h, -d,  -w,  h, -d,
                -w, -h,  d,  w, -h,  d,  w,  h,  d,  -w,  h,  d
            ];
            
            const idx = [
                0,1,2, 0,2,3, 1,5,6, 1,6,2,
                5,4,7, 5,7,6, 4,0,3, 4,3,7,
                3,2,6, 3,6,7, 4,5,1, 4,1,0
            ];
            
            return new Geometry(verts, idx);
        }

        static Icosahedron(radius = 1, detail = 0) {
            // Simplified - return a basic icosahedron
            const verts = [];
            const idx = [];
            
            // Golden ratio
            const phi = (1 + Math.sqrt(5)) / 2;
            const pts = [
                [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
                [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
                [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
            ];
            
            // Normalize vertices
            for (const p of pts) {
                const len = Math.sqrt(p[0]*p[0] + p[1]*p[1] + p[2]*p[2]);
                verts.push(p[0]/len * radius, p[1]/len * radius, p[2]/len * radius);
            }
            
            const faces = [
                [0,11,5], [0,5,1], [0,1,7], [0,7,10], [0,10,11],
                [1,5,9], [5,11,4], [11,10,2], [10,7,6], [7,1,8],
                [3,9,4], [3,4,2], [3,2,6], [3,6,8], [3,8,9],
                [4,9,5], [2,4,11], [6,2,10], [8,6,7], [9,8,1]
            ];
            
            for (const f of faces) {
                idx.push(f[0], f[1], f[2]);
            }
            
            return new Geometry(verts, idx);
        }
    }

    class Mesh {
        constructor(geometry, material = {}) {
            this.geometry = geometry;
            this.material = material;
            this.position = [0, 0, 0];
            this.rotation = [0, 0, 0];
            this.scale = [1, 1, 1];
        }
    }

    return {
        VERSION,
        NAME,
        Scene,
        Camera,
        Renderer,
        Geometry,
        Mesh
    };
})();
